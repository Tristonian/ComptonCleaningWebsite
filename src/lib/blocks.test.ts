import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { addImageBlock, addTextBlock, deleteBlock, listBlocks, placeBlock, updateBlockText } from './blocks';
import { blockText, sniffImage } from './blocks-shared';

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
let db: Db;

beforeEach(async () => {
  ({ db } = await makeTestDb());
});

const order = async (zone: string) => (await listBlocks(db)).filter((b) => b.zone === zone).map((b) => b.textEn || b.hash?.[0]);

async function seed() {
  await addTextBlock({ zone: 'services', text: 'a', by: 's' }, db);
  await addTextBlock({ zone: 'services', text: 'b', by: 's' }, db);
  await addTextBlock({ zone: 'services', text: 'c', by: 's' }, db);
  return (await listBlocks(db)).map((b) => b.id);
}

describe('blocks', () => {
  it('adds in order and rejects unknown zones', async () => {
    await seed();
    expect(await order('services')).toEqual(['a', 'b', 'c']);
    expect((await addTextBlock({ zone: 'nope', by: 's' }, db)).ok).toBe(false);
  });

  it('adds a photo block with its dimensions', async () => {
    await addImageBlock({ zone: 'intro', hash: H1, width: 800, height: 600, contentType: 'image/webp', by: 's' }, db);
    const [b] = await listBlocks(db);
    expect(b).toMatchObject({ kind: 'image', hash: H1, width: 800, height: 600, zone: 'intro' });
  });

  it('moves within a zone: before an earlier item and after a later one', async () => {
    const [a, , c] = await seed();
    await placeBlock({ id: c, zone: 'services', index: 0, by: 's' }, db);
    expect(await order('services')).toEqual(['c', 'a', 'b']);
    // "insert before the item currently at index 3" = the end
    await placeBlock({ id: c, zone: 'services', index: 3, by: 's' }, db);
    expect(await order('services')).toEqual(['a', 'b', 'c']);
    // one step down (index i+2)
    await placeBlock({ id: a, zone: 'services', index: 2, by: 's' }, db);
    expect(await order('services')).toEqual(['b', 'a', 'c']);
  });

  it('moves between zones and a huge index means the end', async () => {
    const [a] = await seed();
    await addTextBlock({ zone: 'prices', text: 'p', by: 's' }, db);
    await placeBlock({ id: a, zone: 'prices', index: 1e6, by: 's' }, db);
    expect(await order('prices')).toEqual(['p', 'a']);
    expect(await order('services')).toEqual(['b', 'c']);
  });

  it('stores text per language with Welsh falling back to English', async () => {
    await addTextBlock({ zone: 'intro', text: 'hello', by: 's' }, db);
    const [b0] = await listBlocks(db);
    expect(blockText(b0, 'cy')).toBe('hello');
    await updateBlockText({ id: b0.id, locale: 'cy', text: ' helo ', by: 's' }, db);
    const [b1] = await listBlocks(db);
    expect(blockText(b1, 'cy')).toBe('helo');
    expect(blockText(b1, 'en')).toBe('hello');
    expect((await updateBlockText({ id: b0.id, locale: 'fr', text: 'x', by: 's' }, db)).ok).toBe(false);
  });

  it('deleting reports an orphaned photo only when nothing else uses it', async () => {
    await addImageBlock({ zone: 'intro', hash: H2, width: 1, height: 1, contentType: 'image/png', by: 's' }, db);
    await addImageBlock({ zone: 'prices', hash: H2, width: 1, height: 1, contentType: 'image/png', by: 's' }, db);
    const [one, two] = await listBlocks(db);
    expect(await deleteBlock({ id: one.id, by: 's' }, db)).toEqual({ ok: true, orphanHash: null });
    expect(await deleteBlock({ id: two.id, by: 's' }, db)).toEqual({ ok: true, orphanHash: H2 });
    expect(await listBlocks(db)).toEqual([]);
  });
});

describe('sniffImage', () => {
  it('trusts bytes, not claims', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new Uint8Array(12);
    webp.set([...'RIFF'].map((c) => c.charCodeAt(0)));
    webp.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
    expect(sniffImage(webp)).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="x"></svg>'))).toBeNull();
  });
});
