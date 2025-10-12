import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 500), 5000);

  const rows = await query(`
    SELECT id, abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag,
           teilnahme, bearbeiter, abgegeben, vergabe_nr, link,
           created_at, updated_at
    FROM public.ausschreibungen
    ORDER BY COALESCE(abgabefrist, '9999-12-31') ASC, id ASC
    LIMIT $1
  `, [limit]);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.name || String(b.name).trim() === "") {
    return NextResponse.json({ error: "Name ist Pflichtfeld." }, { status: 400 });
  }

  // Reihenfolge passt zu deinem Shiny-INSERT
  const sql = `
    INSERT INTO public.ausschreibungen
    (abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag,
     teilnahme, grund_bei_ablehnung, bearbeiter, bemerkung,
     abgegeben, abholfrist, fragefrist, besichtigung, bewertung,
     zuschlagsfrist, ausfuehrung, vergabe_nr, link, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
    RETURNING id;`;

  const params = [
    b.abgabefrist ?? null,
    b.uhrzeit ?? "",
    b.ort ?? "",
    b.name ?? "",
    b.kurzbesch_auftrag ?? "",
    b.teilnahme ?? "",
    b.grund_bei_ablehnung ?? "",
    b.bearbeiter ?? "",
    b.bemerkung ?? "",
    Boolean(b.abgegeben ?? false),
    b.abholfrist ?? null,
    b.fragefrist ?? null,
    b.besichtigung ?? "",
    b.bewertung ?? "",
    b.zuschlagsfrist ?? null,
    b.ausfuehrung ?? "",
    b.vergabe_nr ?? "",
    b.link ?? ""
  ];

  const rows = await query<{ id: number }>(sql, params);
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
