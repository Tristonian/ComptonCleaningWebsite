import 'server-only';
import { neon } from '@neondatabase/serverless';
import { requireEnv } from '@/lib/env';
import { createReadBatcher } from '@/lib/query-batch';

/**
 * The only place that reaches for the database (ADR 0005). Store and session code take a `Db`
 * as a parameter so tests can inject an in-process Postgres (PGlite) running the real migrations.
 */
export type Row = Record<string, unknown>;
export interface Statement {
  text: string;
  params?: unknown[];
}
export interface Db {
  /** One parameterised query ($1, $2, ...) -> rows. */
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Several statements as ONE atomic transaction (all or nothing). */
  transaction(statements: Statement[]): Promise<void>;
}

type Reader = { url: string; sql: ReturnType<typeof neon<false, false>>; read: (text: string, params?: unknown[]) => Promise<Row[]> };
let shared: Reader | undefined;

/** One driver and one batcher per isolate, so reads from different getDb() calls still share a trip. */
function reader(): Reader {
  const url = requireEnv('DATABASE_URL');
  if (shared && shared.url === url) return shared;
  const sql = neon(url);
  const read = createReadBatcher<Row>({
    runOne: async (text, params) => (await sql.query(text, params)) as Row[],
    runMany: async (statements) =>
      (await sql.transaction((txn) => statements.map((s) => txn.query(s.text, s.params)))) as Row[][],
  });
  const made: Reader = { url, sql, read };
  shared = made;
  return made;
}

/**
 * Neon over HTTP: no TCP from the Worker. Reads issued in the same tick share one HTTP round trip
 * (query-batch.ts) to keep CPU time per request low on the free Workers plan.
 */
export function getDb(): Db {
  const { sql, read } = reader();
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      return (await read(text, params)) as T[];
    },
    async transaction(statements: Statement[]) {
      await sql.transaction((txn) => statements.map((s) => txn.query(s.text, s.params ?? [])));
    },
  };
}
