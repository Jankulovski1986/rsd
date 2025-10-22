// ESM script to run all .sql files in a directory against Postgres
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
dotenvConfig({ path: '.env.local' });
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  const dir = process.argv[2] || 'migrations';
  const abs = join(process.cwd(), dir);
  const files = (await readdir(abs))
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log(`No .sql files in ${abs}`);
    return;
  }

  const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    for (const f of files) {
      const p = join(abs, f);
      const sql = await readFile(p, 'utf8');
      console.log(`\n>>> Running ${f}...`);
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
  console.log('\nAll SQL executed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
