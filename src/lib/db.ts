import 'server-only';
import { neon } from '@neondatabase/serverless';
import { requireEnv } from '@/lib/env';

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

/** Neon over HTTP: no TCP from the Worker. Built per call: it is just a closure over fetch. */
export function getDb(): Db {
  const sql = neon(requireEnv('DATABASE_URL'));
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
    async transaction(statements: Statement[]) {
      await sql.transaction((txn) => statements.map((s) => txn.query(s.text, s.params ?? [])));
    },
  };
}
