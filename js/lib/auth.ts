import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const { rows } = await pool.query(
          `SELECT id, email, name, pass_hash, role, status FROM users WHERE email=$1`,
          [creds.email]
        );
        const user = rows[0];
        if (!user) return null;
        if (user.status !== 'active') return null;
        const ok = await bcrypt.compare(creds.password, user.pass_hash);
        if (!ok) return null;

        // Audit login attempt; ignore failures
        try {
          const h = headers();
          const fwd = h.get("x-forwarded-for") || h.get("x-real-ip") || undefined;
          const ip = fwd ? fwd.split(",")[0].trim() : null;
          const userAgent = h.get("user-agent");
          const requestId = (globalThis.crypto as any)?.randomUUID?.() ?? require("node:crypto").randomUUID();
          await logAudit(pool, {
            action: "login",
            table: "users",
            rowPk: { id: user.id },
            after: { email: user.email, role: user.role },
            actorUserId: Number(user.id),
            actorEmail: user.email,
            ip, userAgent: userAgent ?? null, requestId,
          });
        } catch (e) {
          console.error("audit login failed", e);
        }

        return { id: String(user.id), email: user.email, name: user.name, role: user.role } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token as any;
    },
    async session({ session, token }) {
      (session.user as any).role = (token as any).role;
      (session.user as any).id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function auth() {
  return getServerSession(authOptions) as any;
}

export type Role = 'admin'|'vertrieb'|'viewer';
export const canWrite = (r?: Role) => r === 'admin' || r === 'vertrieb';
