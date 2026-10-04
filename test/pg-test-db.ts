import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Db, Statement } from '../src/lib/db';

/**
 * Real Postgres in-process (PGlite) running the REAL migrations from /db/migrations, so store
 * code is tested against the actual schema, constraints and RLS statements (ADR 0005).
 */
export async function makeTestDb(): Promise<{ db: Db; pg: PGlite }> {
  // Neon's driver returns bigint (int8) as a string; make PGlite do the same so tests match production.
  const pg = new PGlite({ parsers: { 20: (v: string) => v } });
  const dir = path.resolve(__dirname, '../db/migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(path.join(dir, f), 'utf8'));
  }
  const db: Db = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query(text, params)).rows as T[];
    },
    async transaction(statements: Statement[]) {
      await pg.transaction(async (tx) => {
        for (const s of statements) await tx.query(s.text, s.params ?? []);
      });
    },
  };
  return { db, pg };
}
