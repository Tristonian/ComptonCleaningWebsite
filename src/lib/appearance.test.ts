import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { DEFAULT_LOGO, addLogo, getAppearance, listLogos, removeLogo, setActiveLogo, setHeroColour } from './appearance';
import { normaliseHex, pngSize, whiteContrast } from './appearance-shared';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
let db: Db;

beforeEach(async () => {
  ({ db } = await makeTestDb());
});

describe('appearance store', () => {
  it('defaults to the shipped logo and no colour', async () => {
    expect(await getAppearance(db)).toEqual({ logo: DEFAULT_LOGO, heroColour: null });
  });

  it('an uploaded logo becomes active and can be switched back', async () => {
    await addLogo({ hash: A, width: 1200, height: 630, label: 'x', by: 'sam@x.co' }, db);
    expect((await getAppearance(db)).logo).toEqual({ src: `/img/${A}`, width: 1200, height: 630 });
    await setActiveLogo(null, 'sam@x.co', db);
    expect((await getAppearance(db)).logo).toEqual(DEFAULT_LOGO);
    await setActiveLogo(A, 'sam@x.co', db);
    expect((await listLogos(db)).activeHash).toBe(A);
  });

  it('refuses to select an unknown logo or delete the active one', async () => {
    expect((await setActiveLogo(B, 's', db)).ok).toBe(false);
    await addLogo({ hash: A, width: 10, height: 10, label: '', by: 's' }, db);
    expect((await removeLogo(A, 's', db)).ok).toBe(false);
    await setActiveLogo(null, 's', db);
    expect((await removeLogo(A, 's', db)).ok).toBe(true);
    expect((await listLogos(db)).logos).toHaveLength(0);
  });

  it('validates and resets the colour', async () => {
    expect((await setHeroColour('red; background:url(x)', 's', db)).ok).toBe(false);
    expect((await setHeroColour('#0E8ABE', 's', db)).ok).toBe(true);
    expect((await getAppearance(db)).heroColour).toBe('#0e8abe');
    await setHeroColour(null, 's', db);
    expect((await getAppearance(db)).heroColour).toBeNull();
  });
});

describe('appearance helpers', () => {
  it('normaliseHex', () => {
    expect(normaliseHex('0E8ABE')).toBe('#0e8abe');
    expect(normaliseHex('#fff')).toBeNull();
    expect(normaliseHex(5)).toBeNull();
  });
  it('whiteContrast is high on navy and low on pale yellow', () => {
    expect(whiteContrast('#085478')).toBeGreaterThan(7);
    expect(whiteContrast('#ffff99')).toBeLessThan(2);
  });
  it('pngSize reads the IHDR and rejects non-PNG', () => {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(b.buffer).setUint32(16, 1200);
    new DataView(b.buffer).setUint32(20, 630);
    expect(pngSize(b)).toEqual({ width: 1200, height: 630 });
    expect(pngSize(new Uint8Array(30))).toBeNull();
  });
});
