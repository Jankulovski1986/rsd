import { NextResponse } from "next/server";
import { Pool } from "pg";

// Ein globaler Pool (hot-reload-sicher)
let pool: Pool;
declare global { var _pgPool: Pool | undefined }
if (!global._pgPool) {
  global._pgPool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
}
pool = global._pgPool!;

export const runtime = "nodejs";        // wichtig für pg
export const dynamic = "force-dynamic"; // kein Caching

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? 50);
    const limit = Math.max(1, Math.min(5000, isNaN(limitRaw) ? 50 : limitRaw));

    const { rows } = await pool.query(
      `SELECT * FROM public.ausschreibungen
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );

    // Immer JSON zurückgeben (auch bei 0 Treffern: [])
    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    console.error("[/api/ausschreibungen] ERROR:", err);
    // Nie leeren Body senden
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
