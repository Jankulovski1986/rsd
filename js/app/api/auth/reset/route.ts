export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
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
  const { token, password } = await req.json().catch(() => ({} as any));
  if (!token || typeof token !== 'string' || !password || typeof password !== 'string' || password.length < 10) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const t = await pool.query(
    `SELECT t.id, t.user_id, u.email
       FROM user_tokens t JOIN users u ON u.id=t.user_id
     WHERE t.token_hash=$1 AND t.type='reset'
       AND t.consumed_at IS NULL AND t.expires_at > now()`,
    [tokenHash]
  );
  if (t.rowCount === 0) return NextResponse.json({ error: "token invalid" }, { status: 400 });

  const { id: tokenId, user_id, email } = t.rows[0];
  const pass_hash = await bcrypt.hash(password, 12);
  await pool.query(`UPDATE users SET pass_hash=$1 WHERE id=$2`, [pass_hash, user_id]);
  await pool.query(`UPDATE user_tokens SET consumed_at=now() WHERE id=$1`, [tokenId]);

  const { ip, userAgent, requestId } = getReqMeta(req);
  await logAudit(pool, { action:'update', table:'users', rowPk:{id:user_id}, actorEmail: email, ip, userAgent, requestId });

  return NextResponse.json({ ok:true });
}

