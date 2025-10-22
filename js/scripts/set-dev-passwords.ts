import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
dotenvConfig({ path: '.env.local' });
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  const users = [
    { email: "admin@example.com", pass: "admin123!" },
    { email: "vertrieb@example.com", pass: "vertrieb123!" },
    { email: "viewer@example.com", pass: "viewer123!" },
  ];
  for (const u of users) {
    const pass_hash = await bcrypt.hash(u.pass, 12);
    await pool.query(`UPDATE users SET pass_hash=$1 WHERE email=$2`, [pass_hash, u.email]);
  }
  await pool.end();
  console.log("Dev passwords set.");
}

main().catch(e => { console.error(e); process.exit(1); });
