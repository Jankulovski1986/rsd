import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const rows = await query(`
    SELECT *
    FROM public.ausschreibungen
    WHERE id = $1
    LIMIT 1
  `, [id]);

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const b = await req.json();
  if (!b.name || String(b.name).trim() === "")
    return NextResponse.json({ error: "Name ist Pflichtfeld." }, { status: 400 });

  const sql = `
    UPDATE public.ausschreibungen
    SET abgabefrist=$1, uhrzeit=$2, ort=$3, name=$4, kurzbesch_auftrag=$5,
        teilnahme=$6, grund_bei_ablehnung=$7, bearbeiter=$8, bemerkung=$9,
        abgegeben=$10, abholfrist=$11, fragefrist=$12, besichtigung=$13, bewertung=$14,
        zuschlagsfrist=$15, ausfuehrung=$16, vergabe_nr=$17, link=$18
    WHERE id=$19
    RETURNING id;
  `;

  const paramsArr = [
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
    b.link ?? "",
    id
  ];

  const rows = await query<{ id: number }>(sql, paramsArr);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: rows[0].id });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const rows = await query<{ id: number }>(
    "DELETE FROM public.ausschreibungen WHERE id=$1 RETURNING id",
    [id]
  );
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
