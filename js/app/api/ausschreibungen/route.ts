import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit, getReqMeta } from "@/lib/audit";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const sanitizeFolderName = (v: unknown) => {
  if (typeof v !== "string") return "";
  return v.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
};

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
export const revalidate = 0;

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const toNull = (v: any) => (v === undefined || v === "" ? null : v);
    const useExisting = body.useExisting === true;

    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "'name' ist erforderlich" }, { status: 400 });
    }

    // Base directory for attachments (configurable via AUSSCHREIBUNGEN_BASE_DIR)
    const baseDir = process.env.AUSSCHREIBUNGEN_BASE_DIR || path.join(process.cwd(), 'data');

    // Mock mode: write to public/mock/ausschreibungen.json instead of DB
    if (process.env.USE_MOCK === '1') {
      const file = path.join(process.cwd(), "public", "mock", "ausschreibungen.json");
      const txt = await fs.readFile(file, "utf8").catch(() => "[]");
      const arr = Array.isArray(JSON.parse(txt)) ? JSON.parse(txt) : [];
      const now = new Date().toISOString();
      const nextId = arr.reduce((m: number, r: any) => Math.max(m, Number(r?.id ?? 0)), 0) + 1;
      const folderRaw = sanitizeFolderName(body.ordnername);
      const folderName = folderRaw || String(nextId);
      const verzeichnisAbs = path.join(baseDir, folderName);
      try {
        const stat = await fs.stat(verzeichnisAbs).catch(() => null);
        if (stat && !useExisting) {
          return NextResponse.json({ error: "Ordner existiert bereits", code: "folder_exists" }, { status: 409 });
        }
        if (!stat) await fs.mkdir(verzeichnisAbs, { recursive: true });
      } catch (e: any) {
        return NextResponse.json({ error: "Ordner konnte nicht erstellt werden", detail: String(e?.message ?? e) }, { status: 500 });
      }
      const row = {
        id: nextId,
        abgabefrist: toNull(body.abgabefrist),
        uhrzeit: toNull(body.uhrzeit),
        ort: toNull(body.ort),
        name,
        kurzbesch_auftrag: toNull(body.kurzbesch_auftrag),
        teilnahme: toNull(body.teilnahme),
        grund_bei_ablehnung: toNull(body.grund_bei_ablehnung),
        bearbeiter: toNull(body.bearbeiter),
        bemerkung: toNull(body.bemerkung),
        abgegeben: Boolean(body.abgegeben ?? false),
        abholfrist: toNull(body.abholfrist),
        fragefrist: toNull(body.fragefrist),
        besichtigung: toNull(body.besichtigung),
        bewertung: toNull(body.bewertung),
        zuschlagsfrist: toNull(body.zuschlagsfrist),
        ausfuehrung: toNull(body.ausfuehrung),
        vergabe_nr: toNull(body.vergabe_nr),
        link: toNull(body.link),
        verzeichnis: verzeichnisAbs,
        created_at: now,
        updated_at: now,
      };
      arr.unshift(row);
      await fs.writeFile(file, JSON.stringify(arr, null, 2), "utf8");
      return NextResponse.json(row, { status: 201 });
    }

    // Normalfall: in DB schreiben
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
      Boolean(body.abgegeben ?? false),
      toNull(body.abholfrist),
      toNull(body.fragefrist),
      toNull(body.besichtigung),
      toNull(body.bewertung),
      toNull(body.zuschlagsfrist),
      toNull(body.ausfuehrung),
      toNull(body.vergabe_nr),
      toNull(body.link),
    ];

    const sql = `
      INSERT INTO public.ausschreibungen (
        abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag,
        teilnahme, grund_bei_ablehnung, bearbeiter, bemerkung,
        abgegeben, abholfrist, fragefrist, besichtigung, bewertung,
        zuschlagsfrist, ausfuehrung, vergabe_nr, link
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,$14,
        $15,$16,$17,$18
      ) RETURNING *
    `;

    const { rows } = await pool.query(sql, values);

    // After insert: create directory and store path in 'verzeichnis'
    const createdRow = rows[0];
    const folderRaw = sanitizeFolderName(body.ordnername);
    const folderName = folderRaw || String(createdRow.id);
    const dirAbs = path.join(baseDir, folderName);
    try {
      const stat = await fs.stat(dirAbs).catch(() => null);
      if (stat && !useExisting) {
        return NextResponse.json({ error: "Ordner existiert bereits", code: "folder_exists" }, { status: 409 });
      }
      if (!stat) await fs.mkdir(dirAbs, { recursive: true });
    } catch (e: any) {
      return NextResponse.json({ error: "Ordner konnte nicht erstellt werden", detail: String(e?.message ?? e) }, { status: 500 });
    }
    const { rows: updRows } = await pool.query(
      `UPDATE public.ausschreibungen SET verzeichnis=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [dirAbs, createdRow.id]
    );
    const finalRow = updRows[0] ?? createdRow;

    // Audit: create
    try {
      const created = finalRow;
      const session = (await getServerSession(authOptions)) as any;
      const { ip, userAgent, requestId } = getReqMeta(req);
      await logAudit(pool, {
        action: "create",
        table: "ausschreibungen",
        rowPk: { id: created.id },
        after: created,
        actorUserId: session?.user?.id ? Number(session.user.id) : null,
        actorEmail: session?.user?.email ?? null,
        ip, userAgent, requestId,
      });
    } catch (e) {
      console.error("[/api/ausschreibungen POST] audit failed", e);
    }

    return NextResponse.json(finalRow, { status: 201 });
  } catch (err: any) {
    console.error("[/api/ausschreibungen POST] ERROR:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
