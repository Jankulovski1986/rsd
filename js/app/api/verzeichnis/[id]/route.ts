import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const useMock = process.env.USE_MOCK === "1";
const baseDir = process.env.AUSSCHREIBUNGEN_BASE_DIR || path.join(process.cwd(), "data");
const baseResolved = path.resolve(baseDir);

let pool: Pool | null = null;
declare global { var _pgPoolVerzeichnis: Pool | undefined }
if (!useMock) {
  if (!global._pgPoolVerzeichnis) {
    global._pgPoolVerzeichnis = new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
    });
  }
  pool = global._pgPoolVerzeichnis!;
}

function ensureWithinBase(p: string) {
  const resolved = path.resolve(p);
  if (resolved !== baseResolved && !resolved.startsWith(baseResolved + path.sep)) {
    throw new Error("Invalid directory path");
  }
  return resolved;
}

function getMime(n: string): string {
  const ext = (n.toLowerCase().split('.').pop() || '').trim();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'txt': case 'log': return 'text/plain; charset=utf-8';
    case 'csv': return 'text/csv; charset=utf-8';
    case 'json': return 'application/json; charset=utf-8';
    case 'md': return 'text/markdown; charset=utf-8';
    case 'html': case 'htm': return 'text/html; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

async function getRowById(id: string) {
  const idStr = String(id);
  if (!idStr) return null;
  if (useMock) {
    const file = path.join(process.cwd(), "public", "mock", "ausschreibungen.json");
    const txt = await fs.readFile(file, "utf8").catch(() => "[]");
    let arr: any[] = [];
    try { arr = Array.isArray(JSON.parse(txt)) ? JSON.parse(txt) : []; } catch { arr = []; }
    return arr.find((r: any) => String(r?.id) === idStr) ?? null;
  }
  const { rows } = await pool!.query("SELECT * FROM public.ausschreibungen WHERE id=$1", [idStr]);
  return rows[0] ?? null;
}

function resolveDir(row: any, id: string) {
  const raw = (row && typeof row.verzeichnis === "string" && row.verzeichnis.trim()) ? row.verzeichnis : path.join(baseResolved, String(id));
  return ensureWithinBase(raw);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx.params.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const row = await getRowById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let dir: string;
    try { dir = resolveDir(row, id); }
    catch { return NextResponse.json({ error: "Invalid directory path" }, { status: 400 }); }

    const dirStat = await fs.stat(dir).catch(() => null);
    const dirExists = !!dirStat && dirStat.isDirectory();

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const inline = /^(1|true|yes)$/i.test(String(searchParams.get("inline") ?? ""));

    if (name) {
      // Stream a single file (safe basename only, no subfolders)
      const safeName = path.basename(name);
      const filePath = path.join(dir, safeName);
      const st = await fs.stat(filePath).catch(() => null);
      if (!st || !st.isFile()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const data = await fs.readFile(filePath);
      const headers = new Headers();
      headers.set("content-type", getMime(safeName));
      headers.set("content-length", String(data.byteLength));
      const disp = inline ? 'inline' : 'attachment';
      headers.set("content-disposition", `${disp}; filename="${encodeURIComponent(safeName)}"`);
      const body = new Uint8Array(data);
      return new Response(body, { status: 200, headers });
    }

    if (!dirExists) {
      const dirName = path.basename(dir);
      return NextResponse.json({ entries: [], dirName, missing: true }, { status: 200 });
    }

    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const entries = await Promise.all(dirents.map(async (d) => {
      const p = path.join(dir, d.name);
      const st = await fs.stat(p).catch(() => null);
      return {
        name: d.name,
        isDir: d.isDirectory(),
        size: st?.size ?? 0,
        mtime: st?.mtime?.toISOString?.() ?? null,
      };
    }));
    const dirName = path.basename(dir);
    return NextResponse.json({ entries, dirName, missing: false }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/verzeichnis/[id]] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx.params.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const row = await getRowById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let dir: string;
    try { dir = resolveDir(row, id); }
    catch { return NextResponse.json({ error: "Invalid directory path" }, { status: 400 }); }

    const dirStat = await fs.stat(dir).catch(() => null);
    if (dirStat && !dirStat.isDirectory()) {
      return NextResponse.json({ error: "Target exists but is not a directory" }, { status: 400 });
    }
    if (!dirStat) {
      await fs.mkdir(dir, { recursive: true }).catch((e) => {
        throw new Error(`Directory could not be created: ${String(e?.message ?? e)}`);
      });
    }

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form-data" }, { status: 400 });

    const items: any[] = ([] as any[])
      .concat(form.getAll('files') as any[])
      .concat(form.getAll('file') as any[]);
    const files = items.filter((f) => f && typeof (f as any).arrayBuffer === 'function' && typeof (f as any).name === 'string');
    if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    const saved: string[] = [];
    const errors: { name: string; error: string }[] = [];

    async function uniquePath(p: string): Promise<string> {
      try {
        await fs.stat(p);
        // exists -> add suffix
        const ext = path.extname(p);
        const base = p.slice(0, p.length - ext.length);
        let i = 1;
        while (true) {
          const cand = `${base} (${i})${ext}`;
          try { await fs.stat(cand); i++; } catch { return cand; }
        }
      } catch {
        return p; // does not exist
      }
    }

    for (const f of files) {
      try {
        const name = path.basename(String((f as any).name || ''));
        if (!name) { errors.push({ name: '(unnamed)', error: 'empty filename' }); continue; }
        const ab = await (f as any).arrayBuffer();
        const buf = Buffer.from(ab);
        const target0 = path.join(dir, name);
        const target = await uniquePath(target0);
        await fs.writeFile(target, buf);
        saved.push(path.basename(target));
      } catch (e: any) {
        errors.push({ name: String((f as any)?.name ?? ''), error: String(e?.message ?? e) });
      }
    }

    return NextResponse.json({ saved, errors }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/verzeichnis/[id] POST] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = String(ctx.params.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const row = await getRowById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let dir: string;
    try { dir = resolveDir(row, id); }
    catch { return NextResponse.json({ error: "Invalid directory path" }, { status: 400 }); }

    const safeName = path.basename(name);
    const filePath = path.join(dir, safeName);
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await fs.unlink(filePath);
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("[/api/verzeichnis/[id] DELETE] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
