export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { randomBytes, createHash } from "node:crypto";
import { sendInvite } from "@/lib/mailer";
import { logAudit, getReqMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email, name, role } = await req.json().catch(() => ({} as any));
  if (!email || !['admin','vertrieb','viewer'].includes(role)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `INSERT INTO users(email,name,role,status,pass_hash)
       VALUES($1,$2,$3,'pending','x')
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role
       RETURNING id,email,role,status`,
      [email, name ?? null, role]
    );
    const user = u.rows[0];

    const tokenPlain = randomBytes(24).toString("hex");
    const tokenHash = createHash('sha256').update(tokenPlain).digest('hex');
    const ttlHours = 24;
    await client.query(
      `INSERT INTO user_tokens(user_id,type,token_hash,expires_at)
       VALUES ($1,'invite',$2, now() + ($3 || ' hours')::interval)`,
      [user.id, tokenHash, String(ttlHours)]
    );

    await client.query('COMMIT');

    const base = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:7777';
    const link = `${base}/invite?token=${encodeURIComponent(tokenPlain)}`;

    try {
      await sendInvite(email, link);
    } catch (e) {
      console.error('sendInvite failed', e);
    }

    const { ip, userAgent, requestId } = getReqMeta(req);
    await logAudit(pool, {
      action: 'create',
      table: 'users',
      rowPk: { id: user.id },
      after: { email: user.email, role: user.role, status: 'pending' },
      actorUserId: Number(session.user.id),
      actorEmail: session.user.email,
      ip, userAgent, requestId,
    });

    const hostConfigured = Boolean(process.env.SMTP_HOST);
    return NextResponse.json({ ok: true, inviteLink: hostConfigured ? undefined : link });
  } catch (e: any) {
    await pool.query('ROLLBACK');
    console.error('[invite] error', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}
