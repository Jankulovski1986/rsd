import { NextResponse } from "next/server";
import { Pool } from "pg";
import * as fs from "node:fs/promises";
import * as path from "node:path";

let pool: Pool;
declare global { var _pgPoolCols: Pool | undefined }
if (!global._pgPoolCols) {
  global._pgPoolCols = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
}
pool = global._pgPoolCols!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export async function GET() {
  try {
    // In Mock-Modus nehmen wir die Keys aus der JSON-Datei
    if (process.env.USE_MOCK === '1') {
      const file = path.join(process.cwd(), "public", "mock", "ausschreibungen.json");
      const txt = await fs.readFile(file, "utf8").catch(() => "[]");
      const arr = JSON.parse(txt);
      const keys: string[] = Array.isArray(arr)
        ? unique(arr.flatMap((r: any) => (r && typeof r === 'object') ? Object.keys(r) : []))
        : [];
      // Sinnvolle Sortierung: id zuerst, dann bekannte Felder, dann Rest alphabetisch
      const preferred = [
        'id','abgabefrist','uhrzeit','ort','name','kurzbesch_auftrag','teilnahme','bearbeiter','abgegeben','vergabe_nr','link','verzeichnis',
        'grund_bei_ablehnung','bemerkung','abholfrist','fragefrist','besichtigung','bewertung','zuschlagsfrist','ausfuehrung','created_at','updated_at'
      ];
      // Immer Preferred zuerst aufführen, fehlende Keys in den Daten werden trotzdem angezeigt (leere Zellen)
      const ordered = unique([...preferred, ...keys]);
      return NextResponse.json(ordered, { status: 200 });
    }

    const sql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ausschreibungen'
      ORDER BY ordinal_position
    `;
    const { rows } = await pool.query(sql);
    const colsRaw = rows.map((r: any) => r.column_name as string);
    const preferred = [
      'id','abgabefrist','uhrzeit','ort','name','kurzbesch_auftrag','teilnahme','bearbeiter','abgegeben','vergabe_nr','link','verzeichnis',
      'grund_bei_ablehnung','bemerkung','abholfrist','fragefrist','besichtigung','bewertung','zuschlagsfrist','ausfuehrung','created_at','updated_at'
    ];
    const rest = colsRaw.filter(k => !preferred.includes(k)).sort((a,b)=>a.localeCompare(b));
    const ordered = preferred.filter(k => colsRaw.includes(k)).concat(rest);
    return NextResponse.json(ordered, { status: 200 });
  } catch (err: any) {
    console.error("[/api/ausschreibungen/columns] ERROR:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
