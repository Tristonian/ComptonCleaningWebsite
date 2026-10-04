// Example customers around Bristol, to try the map, the colour key and the work screen with.
//   npm run db:seed-demo -- --branch staging          add (re-running replaces them)
//   npm run db:seed-demo -- --branch staging --remove  take them all out again
// Invented people only (Ofcom's reserved drama phone numbers, no real addresses). Every demo row has a
// squeegee_ref starting "demo-" and every demo round is named "Demo ...", which is how --remove finds
// them. Refuses to touch production: real customers live there.
import fs from 'node:fs';
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
const remove = process.argv.includes('--remove');
let url = env.DATABASE_URL;
let label = env.NEON_BRANCH || 'DATABASE_URL';
if (branchArg !== -1) {
  label = process.argv[branchArg + 1];
  if (label === 'production') throw new Error('Refusing to add example customers to production.');
  url = execFileSync(
    'neon',
    ['connection-string', label, '--project-id', env.NEON_PROJECT, '--role-name', 'neondb_owner', '--database-name', 'neondb', '--pooled'],
    { env: { ...process.env, NEON_API_KEY: env.NEON_API }, shell: process.platform === 'win32' },
  )
    .toString()
    .match(/postgres\S*/)?.[0];
}
if (!url) throw new Error('No database URL (set DATABASE_URL in .env.local or pass --branch).');
if (label.toLowerCase().includes('prod')) throw new Error('Refusing to add example customers to production.');

// status: how the pin should look today. `days` is how long ago the last clean was, or how far
// the next one is, chosen to land in the right colour whatever day this runs.
//   ok = cleaned a week ago | due = due in 2 days | overdue = due 10 days ago | owing = unpaid last visit | none = no frequency
const AREAS = {
  Clifton: [51.4585, -2.621],
  Redland: [51.468, -2.6],
  Bedminster: [51.44, -2.6],
  Southville: [51.44, -2.613],
  Henleaze: [51.483, -2.605],
  Fishponds: [51.478, -2.53],
  'Lyde Green': [51.499, -2.496],
  Downend: [51.48, -2.495],
  'Staple Hill': [51.469, -2.518],
  Bishopston: [51.473, -2.59],
  Cotham: [51.462, -2.595],
  Easton: [51.459, -2.562],
  Totterdown: [51.44, -2.576],
  Brislington: [51.439, -2.54],
  Westbury: [51.495, -2.62],
  Filton: [51.504, -2.58],
};

const PEOPLE = [
  ['Alex Example', 'Clifton', 'ok', 4, 1500, ['Demo North']],
  ['Bea Sample', 'Redland', 'due', 4, 1500, ['Demo North']],
  ['Cal Demo', 'Henleaze', 'overdue', 4, 1800, ['Demo North']],
  ['Dee Test', 'Westbury', 'owing', 4, 1400, ['Demo North']],
  ['Eli Placeholder', 'Cotham', 'ok', 8, 2000, ['Demo North', 'Demo South']],
  ['Fay Fictional', 'Bishopston', 'due', 4, 1600, ['Demo North']],
  ['Gus Imaginary', 'Bedminster', 'ok', 4, 1300, ['Demo South']],
  ['Hana Pretend', 'Southville', 'overdue', 8, 1700, ['Demo South']],
  ['Ivo Mock', 'Totterdown', 'owing', 4, 1500, ['Demo South']],
  ['Jo Dummy', 'Brislington', 'due', 4, 1500, ['Demo South', 'Demo East']],
  ['Kit Made-Up', 'Easton', 'none', null, 2500, []],
  ['Lou Notreal', 'Fishponds', 'ok', 4, 1500, ['Demo East']],
  ['Max Sample', 'Staple Hill', 'overdue', 4, 1500, ['Demo East']],
  ['Nell Example', 'Downend', 'due', 8, 2200, ['Demo East']],
  ['Oz Demo', 'Lyde Green', 'owing', 4, 1900, ['Demo East']],
  ['Pip Test', 'Filton', 'none', null, 3000, []],
];

const jitter = (seed, scale) => ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * scale;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  // Customers delete their jobs, extras and round places with them (ON DELETE CASCADE).
  await client.query("DELETE FROM customers WHERE squeegee_ref LIKE 'demo-%'");
  await client.query("DELETE FROM rounds WHERE name LIKE 'Demo %'");
  if (remove) {
    await client.query('COMMIT');
    console.log(`removed the example customers and rounds from ${label}`);
  } else {
    const days = { Monday: 1, Wednesday: 3, Friday: 5 };
    const rounds = {};
    for (const [name, weekday] of [['Demo North', days.Monday], ['Demo East', days.Wednesday], ['Demo South', days.Friday]]) {
      const r = await client.query('INSERT INTO rounds (name, weekday, position) VALUES ($1, $2, 100) RETURNING id', [name, weekday]);
      rounds[name] = r.rows[0].id;
    }
    let i = 0;
    for (const [name, area, status, freq, pence, inRounds] of PEOPLE) {
      i++;
      const [lat, lng] = AREAS[area];
      const cycle = (freq ?? 4) * 7;
      // days since the last clean, so that next due = last + cycle lands where we want it
      const since = { ok: 7, due: cycle - 2, overdue: cycle + 10, owing: 5, none: 20 }[status];
      const c = await client.query(
        `INSERT INTO customers (squeegee_ref, name, address, postcode, phone, lat, lng, price_pence, frequency_weeks, preferred_payment, baseline_done_on, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_date - $11::int, 'Example customer: safe to delete.') RETURNING id`,
        [`demo-${i}`, `Demo: ${name}`, `${10 + i} Example Road, ${area}`, '', `0770090${String(1000 + i).slice(1)}`, lat + jitter(i, 0.006), lng + jitter(i + 50, 0.008), pence, freq, i % 3 === 0 ? 'transfer' : i % 3 === 1 ? 'cash' : 'card', since],
      );
      const id = c.rows[0].id;
      for (const rn of inRounds) {
        await client.query('INSERT INTO customer_rounds (customer_id, round_id, position) VALUES ($1, $2, $3)', [id, rounds[rn], i]);
      }
      // Two paid visits of history for everyone with a schedule; an unpaid one for the "owing" ones.
      if (status !== 'none') {
        await client.query(
          `INSERT INTO jobs (customer_id, status, done_on, price_pence, payment_method, paid, created_by)
           VALUES ($1, 'done', current_date - $2::int, $3, 'cash', true, 'demo-seed'),
                  ($1, 'done', current_date - $4::int, $3, 'transfer', true, 'demo-seed')`,
          [id, since + cycle * 2, pence, since + cycle],
        );
      }
      if (status === 'owing') {
        const j = await client.query(
          `INSERT INTO jobs (customer_id, status, done_on, price_pence, payment_method, paid, created_by, notes)
           VALUES ($1, 'done', current_date - 5, $2, '', false, 'demo-seed', 'Customer was out, no payment taken.') RETURNING id`,
          [id, pence],
        );
        await client.query("INSERT INTO job_extras (job_id, label, price_pence) VALUES ($1, 'Conservatory roof', 1000)", [j.rows[0].id]);
      }
    }
    await client.query('COMMIT');
    console.log(`added ${PEOPLE.length} example customers and 3 demo rounds to ${label}`);
  }
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
