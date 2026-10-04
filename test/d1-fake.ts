import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * A minimal D1 look-alike over node:sqlite, running the REAL migrations from /migrations, so
 * store code is tested against the actual schema (constraints included) rather than a mock.
 * Implements only what the app uses: prepare/bind/first/all/run and batch (atomic).
 */
class Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params);
  }
  private args() {
    return this.params as (string | number | null)[];
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...this.args()) as T | undefined) ?? null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.args()) as T[] };
  }
  async run() {
    this.db.prepare(this.sql).run(...this.args());
    return { success: true };
  }
}

export function makeFakeD1() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = path.resolve(__dirname, '../migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(path.join(dir, f), 'utf8'));
  }
  const d1 = {
    prepare: (sql: string) => new Stmt(sqlite, sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec('BEGIN');
      try {
        for (const s of stmts) await s.run();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
      return [];
    },
  };
  return { d1: d1 as unknown as D1Database, sqlite };
}
