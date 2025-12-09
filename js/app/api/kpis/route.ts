import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const total = await query<{ c: number }>("SELECT COUNT(*)::int AS c FROM public.ausschreibungen");
    const open  = await query<{ c: number }>("SELECT COUNT(*)::int AS c FROM public.ausschreibungen WHERE COALESCE(abgegeben,false)=false");
    const nextd = await query<{ d: string | null; nm: string | null }>(`
      WITH parsed AS (
        SELECT
          trim(abgabefrist::text) AS raw,
          CASE
            WHEN abgabefrist IS NULL THEN NULL
            WHEN trim(abgabefrist::text) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(trim(abgabefrist::text), 'YYYY-MM-DD')
            WHEN trim(abgabefrist::text) ~ '^\\d{4}-\\d{2}-\\d{2}[ T].*$' THEN to_date(left(trim(abgabefrist::text), 10), 'YYYY-MM-DD')
            WHEN trim(abgabefrist::text) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(trim(abgabefrist::text), 'DD.MM.YYYY')
            WHEN trim(abgabefrist::text) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}[ T].*$' THEN to_date(left(trim(abgabefrist::text), 10), 'DD.MM.YYYY')
            WHEN trim(abgabefrist::text) ~ '^\\d{2}\\.\\d{2}\\.\\d{2}$' THEN to_date(trim(abgabefrist::text), 'DD.MM.YY')
            WHEN trim(abgabefrist::text) ~ '^\\d{2}\\.\\d{2}\\.\\d{2}[ T].*$' THEN to_date(left(trim(abgabefrist::text), 8), 'DD.MM.YY')
            ELSE NULL
          END AS d,
          COALESCE(name,'') AS nm,
          COALESCE(abgegeben,false) AS submitted
        FROM public.ausschreibungen
      )
      SELECT d, nm
      FROM parsed
      WHERE d IS NOT NULL
        AND submitted = false
        AND d >= CURRENT_DATE
        AND d <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY d ASC
      LIMIT 5
    `);
    const next = nextd.find(r => (r.nm ?? '').trim()) ?? nextd[0];
    return NextResponse.json({
      total: total[0]?.c ?? 0,
      open: open[0]?.c ?? 0,
      nextDate: next?.d ?? null,
      nextName: (next?.nm ?? '').trim() || null,
    });
  } catch (err) {
    console.error("KPIs route failed", err);
    return NextResponse.json({ total: 0, open: 0, nextDate: null, nextName: null }, { status: 200 });
  }
}
