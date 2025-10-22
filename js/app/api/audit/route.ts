export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;

  const where: string[] = [];
  const params: any[] = [];

  const from = sp.get('from');
  const to = sp.get('to');
  const action = sp.get('action');
  const table = sp.get('table');
  const actor = sp.get('actor');
  const pk = sp.get('pk');
  const q = sp.get('query');
  const limit = Math.max(1, Math.min(100, Number(sp.get('limit') ?? 50) || 50));
  const offset = Math.max(0, Number(sp.get('offset') ?? 0) || 0);

  if (from) { params.push(from); where.push(`at >= $${params.length}`); }
  if (to)   { params.push(to);   where.push(`at <  $${params.length}`); }

  if (action) {
    const arr = action.split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) { params.push(arr); where.push(`action = ANY ($${params.length})`); }
  }
  if (table) {
    const arr = table.split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) { params.push(arr); where.push(`table_name = ANY ($${params.length})`); }
  }
  if (actor) {
    if (/^\d+$/.test(actor)) { params.push(Number(actor)); where.push(`actor_user_id = $${params.length}`); }
    else { params.push(actor); where.push(`actor_email = $${params.length}`); }
  }
  if (pk) {
    const idVal = /^\d+$/.test(pk) ? Number(pk) : pk;
    params.push(JSON.stringify({ id: idVal }));
    where.push(`row_pk @> $${params.length}::jsonb`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(row_pk::text ILIKE $${params.length} OR before::text ILIKE $${params.length} OR after::text ILIKE $${params.length})`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const list = await pool.query(
    `SELECT id, at, action, table_name, row_pk, before, after, actor_user_id, actor_email, ip, user_agent, request_id
       FROM audit_log
       ${whereSQL}
       ORDER BY at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, limit, offset]
  );
  const cnt = await pool.query(
    `SELECT COUNT(*)::bigint AS n FROM audit_log ${whereSQL}`,
    params
  );

  return NextResponse.json({ data: list.rows, total: Number(cnt.rows[0]?.n ?? 0), limit, offset });
}

