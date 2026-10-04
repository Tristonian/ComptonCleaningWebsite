import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { RATE_LIMIT, checkEnquiry } from './enquiry';
import { markEmailed, storeEnquiry } from './enquiries-store';

let db: Db;
let pg: PGlite;
beforeEach(async () => {
  ({ db, pg } = await makeTestDb());
});

const checked = checkEnquiry({
  name: 'Jo',
  address: '1 High St',
  postcode: 'bs161aa',
  phone: '07700 900123',
  email: 'Jo@Example.com',
  service: 'gutter-cleaning',
  source: 'facebook',
  notes: 'Side gate',
  lat: '51.5121',
  lng: '-2.5111',
});
if (!checked.ok) throw new Error('fixture invalid');
const input = checked.value;

describe('storeEnquiry', () => {
  it('stores the enquiry with a normalised postcode and notes', async () => {
    const r = await storeEnquiry(db, input, { ipHash: 'h1', locale: 'en' });
    expect(r.ok).toBe(true);
    const { rows } = await pg.query<{ postcode: string; notes: string; emailed_at: unknown }>(
      'SELECT postcode, notes, emailed_at FROM enquiries',
    );
    expect(rows).toEqual([{ postcode: 'BS16 1AA', notes: 'Side gate', emailed_at: null }]);
  });

  it('stores phone and email separately, plus a readable contact line', async () => {
    await storeEnquiry(db, input, { ipHash: 'p', locale: 'en' });
    const { rows } = await pg.query<{ contact: string; phone: string; email: string }>('SELECT contact, phone, email FROM enquiries');
    expect(rows).toEqual([{ contact: '07700 900123 / jo@example.com', phone: '+447700900123', email: 'jo@example.com' }]);
  });

  it('stores the service and where they heard about us', async () => {
    await storeEnquiry(db, input, { ipHash: 's', locale: 'en' });
    const { rows } = await pg.query<{ service: string; source: string }>('SELECT service, source FROM enquiries');
    expect(rows).toEqual([{ service: 'gutter-cleaning', source: 'facebook' }]);
  });

  it('the database refuses a row with no way to reach the customer', async () => {
    await expect(
      pg.query("INSERT INTO enquiries (name,address,contact,locale) VALUES ('a','b','','en')"),
    ).rejects.toThrow();
  });

  it('stores the confirmed pin, and null when there is none', async () => {
    await storeEnquiry(db, input, { ipHash: 'a', locale: 'en' });
    await storeEnquiry(db, { ...input, point: null }, { ipHash: 'b', locale: 'en' });
    const { rows } = await pg.query<{ lat: number | null; lng: number | null }>('SELECT lat, lng FROM enquiries ORDER BY id');
    expect(rows).toEqual([{ lat: 51.5121, lng: -2.5111 }, { lat: null, lng: null }]);
  });

  it('rate limits one sender per hour but not a different sender', async () => {
    for (let i = 0; i < RATE_LIMIT.perSenderPerHour; i++) {
      expect((await storeEnquiry(db, input, { ipHash: 'same', locale: 'en' })).ok).toBe(true);
    }
    expect(await storeEnquiry(db, input, { ipHash: 'same', locale: 'en' })).toEqual({ ok: false, reason: 'rate' });
    expect((await storeEnquiry(db, input, { ipHash: 'other', locale: 'en' })).ok).toBe(true);
  });

  it('an old enquiry from the same sender no longer counts after an hour', async () => {
    for (let i = 0; i < RATE_LIMIT.perSenderPerHour; i++) {
      await storeEnquiry(db, input, { ipHash: 'same', locale: 'en' });
    }
    await pg.exec("UPDATE enquiries SET created_at = now() - interval '2 hours'");
    expect((await storeEnquiry(db, input, { ipHash: 'same', locale: 'en' })).ok).toBe(true);
  });

  it('caps the whole site per day', async () => {
    for (let i = 0; i < RATE_LIMIT.perSiteDay; i++) {
      await storeEnquiry(db, input, { ipHash: `sender-${i}`, locale: 'en' });
    }
    expect(await storeEnquiry(db, input, { ipHash: 'fresh', locale: 'en' })).toEqual({ ok: false, reason: 'rate' });
  });

  it('markEmailed stamps the row', async () => {
    const r = await storeEnquiry(db, input, { ipHash: 'h', locale: 'cy' });
    if (!r.ok) throw new Error('expected stored');
    await markEmailed(db, r.id);
    const { rows } = await pg.query<{ emailed_at: unknown }>('SELECT emailed_at FROM enquiries');
    expect(rows[0].emailed_at).not.toBeNull();
  });
});
