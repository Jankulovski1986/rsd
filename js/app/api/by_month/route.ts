import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const rows = await query<{ monat: string, n: number }>(`
    SELECT to_char(date_trunc('month', abgabefrist), 'YYYY-MM-01') AS monat,
           COUNT(*)::int AS n
    FROM public.ausschreibungen
    WHERE abgabefrist IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `);
  return NextResponse.json(rows);
}
