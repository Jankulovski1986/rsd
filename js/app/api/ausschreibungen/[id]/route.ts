import { NextResponse } from "next/server";
import { Pool } from "pg";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Reuse the global pool pattern like in parent route
let pool: Pool;
declare global { var _pgPool2: Pool | undefined }
if (!global._pgPool2) {
  global._pgPool2 = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
}
pool = global._pgPool2!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (process.env.USE_MOCK === '1') {
      const file = path.join(process.cwd(), "public", "mock", "ausschreibungen.json");
      const txt = await fs.readFile(file, "utf8").catch(() => "[]");
      const arr = Array.isArray(JSON.parse(txt)) ? JSON.parse(txt) : [];
      const next = arr.filter((r: any) => Number(r?.id) !== id);
      await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
      return NextResponse.json({ ok: true });
    } else {
      await pool.query("DELETE FROM public.ausschreibungen WHERE id=$1", [id]);
      return NextResponse.json({ ok: true });
    }
  } catch (err: any) {
    console.error("[/api/ausschreibungen/[id] DELETE] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const toNull = (v: any) => (v === undefined || v === "" ? null : v);
    const name = body.name === undefined ? undefined : String(body.name ?? "").trim();

    if (process.env.USE_MOCK === '1') {
      const file = path.join(process.cwd(), "public", "mock", "ausschreibungen.json");
      const txt = await fs.readFile(file, "utf8").catch(() => "[]");
      const arr: any[] = Array.isArray(JSON.parse(txt)) ? JSON.parse(txt) : [];
      const idx = arr.findIndex((r: any) => Number(r?.id) === id);
      if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const row = arr[idx];
      const updated = {
        ...row,
        abgabefrist: body.abgabefrist === undefined ? row.abgabefrist : toNull(body.abgabefrist),
        uhrzeit: body.uhrzeit === undefined ? row.uhrzeit : toNull(body.uhrzeit),
        ort: body.ort === undefined ? row.ort : toNull(body.ort),
        name: name === undefined ? row.name : name,
        kurzbesch_auftrag: body.kurzbesch_auftrag === undefined ? row.kurzbesch_auftrag : toNull(body.kurzbesch_auftrag),
        teilnahme: body.teilnahme === undefined ? row.teilnahme : toNull(body.teilnahme),
        grund_bei_ablehnung: body.grund_bei_ablehnung === undefined ? row.grund_bei_ablehnung : toNull(body.grund_bei_ablehnung),
        bearbeiter: body.bearbeiter === undefined ? row.bearbeiter : toNull(body.bearbeiter),
        bemerkung: body.bemerkung === undefined ? row.bemerkung : toNull(body.bemerkung),
        abgegeben: body.abgegeben === undefined ? row.abgegeben : Boolean(body.abgegeben),
        abholfrist: body.abholfrist === undefined ? row.abholfrist : toNull(body.abholfrist),
        fragefrist: body.fragefrist === undefined ? row.fragefrist : toNull(body.fragefrist),
        besichtigung: body.besichtigung === undefined ? row.besichtigung : toNull(body.besichtigung),
        bewertung: body.bewertung === undefined ? row.bewertung : toNull(body.bewertung),
        zuschlagsfrist: body.zuschlagsfrist === undefined ? row.zuschlagsfrist : toNull(body.zuschlagsfrist),
        ausfuehrung: body.ausfuehrung === undefined ? row.ausfuehrung : toNull(body.ausfuehrung),
        vergabe_nr: body.vergabe_nr === undefined ? row.vergabe_nr : toNull(body.vergabe_nr),
        link: body.link === undefined ? row.link : toNull(body.link),
        updated_at: new Date().toISOString(),
      };
      arr[idx] = updated;
      await fs.writeFile(file, JSON.stringify(arr, null, 2), "utf8");
      return NextResponse.json(updated);
    } else {
      const values = [
        toNull(body.abgabefrist),
        toNull(body.uhrzeit),
        toNull(body.ort),
        name,
        toNull(body.kurzbesch_auftrag),
        toNull(body.teilnahme),
        toNull(body.grund_bei_ablehnung),
        toNull(body.bearbeiter),
        toNull(body.bemerkung),
        body.abgegeben === undefined ? undefined : Boolean(body.abgegeben),
        toNull(body.abholfrist),
        toNull(body.fragefrist),
        toNull(body.besichtigung),
        toNull(body.bewertung),
        toNull(body.zuschlagsfrist),
        toNull(body.ausfuehrung),
        toNull(body.vergabe_nr),
        toNull(body.link),
        id,
      ];

      const sql = `
        UPDATE public.ausschreibungen SET
          abgabefrist = COALESCE($1, abgabefrist),
          uhrzeit = COALESCE($2, uhrzeit),
          ort = COALESCE($3, ort),
          name = COALESCE($4, name),
          kurzbesch_auftrag = COALESCE($5, kurzbesch_auftrag),
          teilnahme = COALESCE($6, teilnahme),
          grund_bei_ablehnung = COALESCE($7, grund_bei_ablehnung),
          bearbeiter = COALESCE($8, bearbeiter),
          bemerkung = COALESCE($9, bemerkung),
          abgegeben = COALESCE($10, abgegeben),
          abholfrist = COALESCE($11, abholfrist),
          fragefrist = COALESCE($12, fragefrist),
          besichtigung = COALESCE($13, besichtigung),
          bewertung = COALESCE($14, bewertung),
          zuschlagsfrist = COALESCE($15, zuschlagsfrist),
          ausfuehrung = COALESCE($16, ausfuehrung),
          vergabe_nr = COALESCE($17, vergabe_nr),
          link = COALESCE($18, link)
        WHERE id=$19
        RETURNING *
      `;

      const { rows } = await pool.query(sql, values);
      if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }
  } catch (err: any) {
    console.error("[/api/ausschreibungen/[id] PATCH] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
