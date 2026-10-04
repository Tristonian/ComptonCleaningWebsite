import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb } from '../../../test/pg-test-db';
import type { Db } from '../db';
import { getOverrides, resetNode, saveNode } from './store';

let db: Db;
let pg: PGlite;

beforeEach(async () => {
  ({ db, pg } = await makeTestDb());
});

const audit = async () =>
  (await pg.query<{ email: string; action: string; detail: string }>(
    'SELECT email, action, detail FROM audit_log ORDER BY id',
  )).rows;

describe('saveNode', () => {
  it('stores an override and reads it back for that language only', async () => {
    const r = await saveNode({ locale: 'en', key: 'home.hero.title', value: '  Spotless  ', by: 'sam@gmail.com' }, db);
    expect(r).toEqual({ ok: true });
    expect(await getOverrides('en', db)).toEqual({ 'home.hero.title': 'Spotless' });
    expect(await getOverrides('cy', db)).toEqual({});
  });

  it('English and Welsh are independent rows for the same key', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'Hello', by: 'a@b.c' }, db);
    await saveNode({ locale: 'cy', key: 'x.y', value: 'Helo', by: 'a@b.c' }, db);
    expect(await getOverrides('en', db)).toEqual({ 'x.y': 'Hello' });
    expect(await getOverrides('cy', db)).toEqual({ 'x.y': 'Helo' });
  });

  it('a second save replaces the first and the audit records previous and next', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'one', by: 'sam@gmail.com' }, db);
    await saveNode({ locale: 'en', key: 'x.y', value: 'two', by: 'sam@gmail.com' }, db);
    expect(await getOverrides('en', db)).toEqual({ 'x.y': 'two' });
    const rows = await audit();
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[1].detail)).toMatchObject({ key: 'x.y', previous: 'one', next: 'two' });
    expect(rows[1].email).toBe('sam@gmail.com');
  });

  it('clears needs_review when a human saves', async () => {
    await pg.query(
      "INSERT INTO content_overrides (locale,key,value,needs_review,updated_by) VALUES ('cy','a.b','draft',true,'x')",
    );
    await saveNode({ locale: 'cy', key: 'a.b', value: 'checked', by: 'sam@gmail.com' }, db);
    const { rows } = await pg.query<{ needs_review: boolean }>("SELECT needs_review FROM content_overrides WHERE key='a.b'");
    expect(rows[0].needs_review).toBe(false);
  });

  it('rejects bad input and writes nothing', async () => {
    const bad = [
      { locale: 'fr', key: 'x.y', value: 'hi' },
      { locale: 'en', key: 'Has Spaces', value: 'hi' },
      { locale: 'en', key: '../etc', value: 'hi' },
      { locale: 'en', key: 'x.y', value: '   ' },
      { locale: 'en', key: 'x.y', value: 'a'.repeat(2001) },
      { locale: 'en', key: 'x.y', value: 'bell\u0007' },
      { locale: 'en', key: 'x.y', value: 42 },
      { locale: 'en', key: 'x.y', value: null },
    ];
    for (const args of bad) {
      expect((await saveNode({ ...args, by: 'a@b.c' }, db)).ok).toBe(false);
    }
    expect(await getOverrides('en', db)).toEqual({});
    expect(await audit()).toHaveLength(0);
  });

  it('stores markup as literal text, never interpreting it', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: '<script>alert(1)</script>', by: 'a@b.c' }, db);
    expect((await getOverrides('en', db))['x.y']).toBe('<script>alert(1)</script>');
  });

  it('keeps the data and the audit atomic: a failing write rolls back the audit row too', async () => {
    // The audit insert (first statement) succeeds, then the override insert violates this check.
    await pg.exec("ALTER TABLE content_overrides ADD CONSTRAINT no_boom CHECK (value <> 'boom')");
    const r = await saveNode({ locale: 'en', key: 'x.y', value: 'boom', by: 'a@b.c' }, db);
    expect(r.ok).toBe(false);
    expect(await audit()).toHaveLength(0);
  });
});

describe('resetNode', () => {
  it('deletes the override and logs the previous value', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'custom', by: 'a@b.c' }, db);
    expect(await resetNode({ locale: 'en', key: 'x.y', by: 'a@b.c' }, db)).toEqual({ ok: true });
    expect(await getOverrides('en', db)).toEqual({});
    const last = (await audit()).at(-1)!;
    expect(last.action).toBe('revert');
    expect(JSON.parse(last.detail).previous).toBe('custom');
  });

  it('reverting something never overridden is harmless', async () => {
    expect(await resetNode({ locale: 'en', key: 'x.y', by: 'a@b.c' }, db)).toEqual({ ok: true });
  });

  it('rejects an unknown locale or key', async () => {
    expect((await resetNode({ locale: 'zz', key: 'x.y', by: 'a@b.c' }, db)).ok).toBe(false);
    expect((await resetNode({ locale: 'en', key: 'NOPE!', by: 'a@b.c' }, db)).ok).toBe(false);
  });
});

describe('getOverrides', () => {
  it('falls back to no overrides if the database fails', async () => {
    await pg.exec('DROP TABLE content_overrides');
    expect(await getOverrides('en', db)).toEqual({});
  });
});

describe('row-level security (ADR 0005)', () => {
  it('is enabled on every table in public', async () => {
    const { rows } = await pg.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});
