// Apply db/migrations/*.sql to a Neon database, once each, in order (ADR 0005).
//   npm run db:migrate                      -> DATABASE_URL from .env.local (the dev branch)
//   npm run db:migrate -- --branch staging  -> fetches that branch's string with the neon CLI
//   npm run db:migrate -- --branch production
// Each file runs in its own transaction and is recorded in schema_migrations.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

function readEnvFile() {
  const out = {};
  if (!fs.existsSync('.env.local')) return out;
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

const env = { ...readEnvFile(), ...process.env };
const branchArg = process.argv.indexOf('--branch');
let url = env.DATABASE_URL;
let label = env.NEON_BRANCH || 'DATABASE_URL';
if (branchArg !== -1) {
  label = process.argv[branchArg + 1];
  url = execFileSync(
    'neon',
    ['connection-string', label, '--project-id', env.NEON_PROJECT, '--role-name', 'neondb_owner', '--database-name', 'neondb', '--pooled'],
    { env: { ...process.env, NEON_API_KEY: env.NEON_API }, shell: process.platform === 'win32' },
  )
    .toString()
    .match(/postgres\S*/)?.[0];
}
if (!url) throw new Error('No database URL (set DATABASE_URL in .env.local or pass --branch).');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const dir = path.resolve('db/migrations');
  let applied = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file} to ${label}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${file} failed: ${err.message}`);
    }
  }
  if (!applied) console.log(`${label}: nothing to apply`);
} finally {
  await client.end();
}
