// ESM script to backfill 'verzeichnis' for ausschreibungen
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
dotenvConfig({ path: '.env.local' });

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

async function ensureDir(p) {
  try { await fs.mkdir(p, { recursive: true }); } catch {}
}

async function backfillMock(baseDir) {
  const file = path.join(process.cwd(), 'public', 'mock', 'ausschreibungen.json');
  const txt = await fs.readFile(file, 'utf8').catch(() => '[]');
  const arr = Array.isArray(JSON.parse(txt)) ? JSON.parse(txt) : [];
  let changed = false;
  for (const row of arr) {
    const id = row?.id;
    if (!Number.isFinite(Number(id))) continue;
    const target = path.join(baseDir, String(id));
    await ensureDir(target);
    if (row.verzeichnis !== target) {
      row.verzeichnis = target;
      changed = true;
    }
  }
  if (changed) {
    await fs.writeFile(file, JSON.stringify(arr, null, 2), 'utf8');
  }
  console.log(`Mock: processed ${arr.length} rows${changed ? ' (updated file)' : ''}.`);
}

async function backfillDb(baseDir) {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const { rows } = await pool.query('SELECT id, verzeichnis FROM public.ausschreibungen ORDER BY id');
    let updates = 0;
    for (const r of rows) {
      const id = r.id;
      if (!Number.isFinite(Number(id))) continue;
      const target = path.join(baseDir, String(id));
      await ensureDir(target);
      if (r.verzeichnis !== target) {
        await pool.query('UPDATE public.ausschreibungen SET verzeichnis=$1, updated_at=NOW() WHERE id=$2', [target, id]);
        updates++;
      }
    }
    console.log(`DB: processed ${rows.length} rows, updated ${updates}.`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const baseDir = process.env.AUSSCHREIBUNGEN_BASE_DIR || path.join(process.cwd(), 'data');
  await ensureDir(baseDir);
  if (process.env.USE_MOCK === '1') {
    await backfillMock(baseDir);
  } else {
    await backfillDb(baseDir);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

