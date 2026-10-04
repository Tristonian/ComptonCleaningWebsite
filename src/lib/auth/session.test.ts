import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb } from '../../../test/pg-test-db';
import type { Db } from '../db';

// session.ts imports next/headers and env helpers; only the DB-backed functions are under test.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => undefined }));
vi.mock('@/lib/env', () => ({
  getEnv: (name: string) => (name === 'ADMIN_ALLOWED_EMAILS' ? 'sam@gmail.com' : undefined),
  siteUrl: () => 'https://example.test',
}));

import { createSession, deleteSession, resolveSession } from './session';

let db: Db;
let pg: PGlite;
beforeEach(async () => {
  ({ db, pg } = await makeTestDb());
});

describe('sessions on Postgres', () => {
  it('a created session resolves to its email, and only the hash is stored', async () => {
    const { token } = await createSession('sam@gmail.com', db);
    expect(await resolveSession(token, db)).toEqual({ email: 'sam@gmail.com' });
    const { rows } = await pg.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toContain(token);
  });

  it('an unknown or empty token resolves to nothing', async () => {
    expect(await resolveSession('nope', db)).toBeNull();
    expect(await resolveSession(undefined, db)).toBeNull();
  });

  it('an expired session does not resolve', async () => {
    const { token } = await createSession('sam@gmail.com', db);
    await pg.exec("UPDATE sessions SET expires_at = now() - interval '1 minute'");
    expect(await resolveSession(token, db)).toBeNull();
  });

  it('someone removed from the allow-list is locked out even with a live session', async () => {
    const { token } = await createSession('someone-else@gmail.com', db);
    expect(await resolveSession(token, db)).toBeNull();
  });

  it('slides the expiry forward when less than half the lifetime is left', async () => {
    const { token } = await createSession('sam@gmail.com', db);
    await pg.exec("UPDATE sessions SET expires_at = now() + interval '1 day'");
    await resolveSession(token, db);
    const { rows } = await pg.query<{ days: number }>(
      "SELECT extract(epoch from (expires_at - now())) / 86400 AS days FROM sessions",
    );
    expect(Number(rows[0].days)).toBeGreaterThan(29);
  });

  it('logging out deletes the session, and a new login clears expired ones', async () => {
    const a = await createSession('sam@gmail.com', db);
    await deleteSession(a.token, db);
    expect(await resolveSession(a.token, db)).toBeNull();

    await createSession('sam@gmail.com', db);
    await pg.exec("UPDATE sessions SET expires_at = now() - interval '1 day'");
    await createSession('sam@gmail.com', db);
    const { rows } = await pg.query<{ n: string }>('SELECT count(*) AS n FROM sessions');
    expect(Number(rows[0].n)).toBe(1);
  });
});
