import { beforeEach, describe, expect, it } from 'vitest';
import { makeFakeD1 } from '../../../test/d1-fake';
import { getOverrides, resetNode, saveNode } from './store';

let d1: D1Database;
let sqlite: ReturnType<typeof makeFakeD1>['sqlite'];

beforeEach(() => {
  ({ d1, sqlite } = makeFakeD1());
});

const audit = () =>
  sqlite.prepare('SELECT email, action, detail FROM audit_log ORDER BY id').all() as {
    email: string;
    action: string;
    detail: string;
  }[];

describe('saveNode', () => {
  it('stores an override and reads it back for that language only', async () => {
    const r = await saveNode({ locale: 'en', key: 'home.hero.title', value: '  Spotless  ', by: 'sam@gmail.com' }, d1);
    expect(r).toEqual({ ok: true });
    expect(await getOverrides('en', d1)).toEqual({ 'home.hero.title': 'Spotless' });
    expect(await getOverrides('cy', d1)).toEqual({});
  });

  it('English and Welsh are independent rows for the same key', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'Hello', by: 'a@b.c' }, d1);
    await saveNode({ locale: 'cy', key: 'x.y', value: 'Helo', by: 'a@b.c' }, d1);
    expect(await getOverrides('en', d1)).toEqual({ 'x.y': 'Hello' });
    expect(await getOverrides('cy', d1)).toEqual({ 'x.y': 'Helo' });
  });

  it('a second save replaces the first and the audit records previous and next', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'one', by: 'sam@gmail.com' }, d1);
    await saveNode({ locale: 'en', key: 'x.y', value: 'two', by: 'sam@gmail.com' }, d1);
    expect(await getOverrides('en', d1)).toEqual({ 'x.y': 'two' });
    const rows = audit();
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[1].detail)).toMatchObject({ key: 'x.y', previous: 'one', next: 'two' });
    expect(rows[1].email).toBe('sam@gmail.com');
  });

  it('clears needs_review when a human saves', async () => {
    sqlite
      .prepare("INSERT INTO content_overrides (locale,key,value,needs_review,updated_by,updated_at) VALUES ('cy','a.b','draft',1,'x',0)")
      .run();
    await saveNode({ locale: 'cy', key: 'a.b', value: 'checked', by: 'sam@gmail.com' }, d1);
    const row = sqlite.prepare("SELECT needs_review FROM content_overrides WHERE key='a.b'").get() as {
      needs_review: number;
    };
    expect(row.needs_review).toBe(0);
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
      expect((await saveNode({ ...args, by: 'a@b.c' }, d1)).ok).toBe(false);
    }
    expect(await getOverrides('en', d1)).toEqual({});
    expect(audit()).toHaveLength(0);
  });

  it('stores markup as literal text, never interpreting it', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: '<script>alert(1)</script>', by: 'a@b.c' }, d1);
    expect((await getOverrides('en', d1))['x.y']).toBe('<script>alert(1)</script>');
  });

  it('keeps the data and the audit atomic: a failing write rolls back the audit row too', async () => {
    sqlite.exec('DROP TABLE content_overrides');
    const r = await saveNode({ locale: 'en', key: 'x.y', value: 'hi', by: 'a@b.c' }, d1);
    expect(r.ok).toBe(false);
    expect(audit()).toHaveLength(0);
  });
});

describe('resetNode', () => {
  it('deletes the override and logs the previous value', async () => {
    await saveNode({ locale: 'en', key: 'x.y', value: 'custom', by: 'a@b.c' }, d1);
    expect(await resetNode({ locale: 'en', key: 'x.y', by: 'a@b.c' }, d1)).toEqual({ ok: true });
    expect(await getOverrides('en', d1)).toEqual({});
    const last = audit().at(-1)!;
    expect(last.action).toBe('revert');
    expect(JSON.parse(last.detail).previous).toBe('custom');
  });

  it('reverting something never overridden is harmless', async () => {
    expect(await resetNode({ locale: 'en', key: 'x.y', by: 'a@b.c' }, d1)).toEqual({ ok: true });
  });

  it('rejects an unknown locale or key', async () => {
    expect((await resetNode({ locale: 'zz', key: 'x.y', by: 'a@b.c' }, d1)).ok).toBe(false);
    expect((await resetNode({ locale: 'en', key: 'NOPE!', by: 'a@b.c' }, d1)).ok).toBe(false);
  });
});

describe('getOverrides', () => {
  it('falls back to no overrides if the database fails', async () => {
    sqlite.exec('DROP TABLE content_overrides');
    expect(await getOverrides('en', d1)).toEqual({});
  });
});
