export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { randomBytes, createHash } from "node:crypto";
import { sendReset } from "@/lib/mailer";
import { logAudit, getReqMeta } from "@/lib/audit";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({} as any));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 });
  }

  const u = await pool.query(`SELECT id,email FROM users WHERE email=$1 AND status='active'`, [email]);
  if (u.rowCount === 0) {
    return NextResponse.json({ error: 'E-Mail ist nicht registriert' }, { status: 404 });
  }

  const user = u.rows[0];
  const tokenPlain = randomBytes(24).toString("hex");
  const tokenHash = createHash('sha256').update(tokenPlain).digest('hex');
  await pool.query(
    `INSERT INTO user_tokens(user_id,type,token_hash,expires_at)
     VALUES ($1,'reset',$2, now() + interval '60 minutes')`,
    [user.id, tokenHash]
  );

  const base = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:7777';
  const link = `${base}/reset?token=${encodeURIComponent(tokenPlain)}`;
  try {
    await sendReset(user.email, link);
  } catch (e) {
    console.error('sendReset failed', e);
  }

  const { ip, userAgent, requestId } = getReqMeta(req);
  await logAudit(pool, {
    action: 'update',
    table: 'users',
    rowPk: { id: user.id },
    actorEmail: user.email,
    ip, userAgent, requestId,
  });

  return NextResponse.json({ ok: true });
}
