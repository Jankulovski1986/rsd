import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeJoin(base: string, id: string) {
  const target = path.join(base, id);
  const normBase = path.resolve(base) + path.sep;
  const normTarget = path.resolve(target) + path.sep;
  if (!normTarget.startsWith(normBase)) throw new Error("Path traversal");
  return path.resolve(target);
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

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const baseDir = process.env.AUSSCHREIBUNGEN_BASE_DIR || path.join(process.cwd(), 'data');
    const id = String(ctx.params.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const dir = safeJoin(baseDir, id);

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const inline = /^(1|true|yes)$/i.test(String(searchParams.get("inline") ?? ""));

    if (name) {
      // Stream a single file (safe basename only, no subfolders)
      const safeName = path.basename(name);
      const filePath = path.join(dir, safeName);
      try {
        const st = await fs.stat(filePath);
        if (!st.isFile()) return NextResponse.json({ error: "Not a file" }, { status: 400 });
      } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const data = await fs.readFile(filePath);
      const headers = new Headers();
      headers.set("content-type", getMime(safeName));
      headers.set("content-length", String(data.byteLength));
      const disp = inline ? 'inline' : 'attachment';
      headers.set("content-disposition", `${disp}; filename="${encodeURIComponent(safeName)}"`);
      return new Response(data, { status: 200, headers });
    }

    // List directory
    let entries: any[] = [];
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      entries = await Promise.all(dirents.map(async (d) => {
        const p = path.join(dir, d.name);
        const st = await fs.stat(p).catch(() => null);
        return {
          name: d.name,
          isDir: d.isDirectory(),
          size: st?.size ?? 0,
          mtime: st?.mtime?.toISOString?.() ?? null,
        };
      }));
    } catch {
      entries = [];
    }
    return NextResponse.json(entries, { status: 200 });
  } catch (err: any) {
    console.error("[/api/verzeichnis/[id]] ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const baseDir = process.env.AUSSCHREIBUNGEN_BASE_DIR || path.join(process.cwd(), 'data');
    const id = String(ctx.params.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const dir = safeJoin(baseDir, id);

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form-data" }, { status: 400 });

    const items: any[] = ([] as any[])
      .concat(form.getAll('files') as any[])
      .concat(form.getAll('file') as any[]);
    const files = items.filter((f) => f && typeof (f as any).arrayBuffer === 'function' && typeof (f as any).name === 'string');
    if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    // Ensure target directory exists
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

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
