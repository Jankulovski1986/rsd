import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const total = await query<{ c: number }>("SELECT COUNT(*)::int AS c FROM public.ausschreibungen");
  const open  = await query<{ c: number }>("SELECT COUNT(*)::int AS c FROM public.ausschreibungen WHERE COALESCE(abgegeben,false)=false");
  const nextd = await query<{ d: string | null }>(`
    SELECT MIN(abgabefrist)::date AS d
    FROM public.ausschreibungen
    WHERE abgabefrist IS NOT NULL
  `);
  return NextResponse.json({
    total: total[0]?.c ?? 0,
    open: open[0]?.c ?? 0,
    nextDate: nextd[0]?.d ?? null
  });
}
