import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { addImageBlock, addTextBlock, listBlocks } from './blocks';
import { addService, deleteService, listServices, moveService, serviceText, updateService } from './services-custom';
import { getHiddenSections, isHideable, setSectionHidden } from './sections';

let db: Db;
beforeEach(async () => {
  ({ db } = await makeTestDb());
});

describe('custom services', () => {
  it('adds, edits per language with Welsh fallback, and orders', async () => {
    await addService({ by: 's' }, db);
    await addService({ by: 's' }, db);
    const [a, b] = await listServices(db);
    expect(a.titleEn).toBe('New service');
    await updateService({ id: a.id, locale: 'en', title: 'Pressure washing', body: 'Patios and drives.', by: 's' }, db);
    let [a2] = await listServices(db);
    expect(serviceText(a2, 'title', 'cy')).toBe('Pressure washing');
    await updateService({ id: a.id, locale: 'cy', title: 'Golchi pwysau', body: '', by: 's' }, db);
    [a2] = await listServices(db);
    expect(serviceText(a2, 'title', 'cy')).toBe('Golchi pwysau');
    expect(serviceText(a2, 'body', 'cy')).toBe('Patios and drives.');
    expect((await updateService({ id: a.id, locale: 'en', title: ' ', body: 'x', by: 's' }, db)).ok).toBe(false);

    await moveService({ id: b.id, dir: -1, by: 's' }, db);
    expect((await listServices(db)).map((s) => s.id)).toEqual([b.id, a.id]);
    expect((await moveService({ id: b.id, dir: -1, by: 's' }, db)).ok).toBe(true); // already first
  });

  it('a service owns a zone: blocks only go into zones that exist, and deleting clears them', async () => {
    await addService({ by: 's' }, db);
    const [svc] = await listServices(db);
    expect((await addTextBlock({ zone: 'svc-9999', by: 's' }, db)).ok).toBe(false);
    await addTextBlock({ zone: `svc-${svc.id}`, text: 'hi', by: 's' }, db);
    await addImageBlock({ zone: `svc-${svc.id}`, hash: 'c'.repeat(64), width: 1, height: 1, contentType: 'image/webp', by: 's' }, db);
    expect(await listBlocks(db)).toHaveLength(2);
    expect(await deleteService({ id: svc.id, by: 's' }, db)).toEqual({ ok: true, orphanHashes: ['c'.repeat(64)] });
    expect(await listBlocks(db)).toEqual([]);
    expect(await listServices(db)).toEqual([]);
  });
});

describe('hidden sections', () => {
  it('hides and shows, only known ids, contact never', async () => {
    expect(await getHiddenSections(db)).toEqual([]);
    await setSectionHidden({ id: 'prices', hidden: true, by: 's' }, db);
    await setSectionHidden({ id: 'svc-3', hidden: true, by: 's' }, db);
    await setSectionHidden({ id: 'prices', hidden: true, by: 's' }, db);
    expect(await getHiddenSections(db)).toEqual(['prices', 'svc-3']);
    await setSectionHidden({ id: 'prices', hidden: false, by: 's' }, db);
    expect(await getHiddenSections(db)).toEqual(['svc-3']);
    expect((await setSectionHidden({ id: 'contact', hidden: true, by: 's' }, db)).ok).toBe(false);
    expect(isHideable('svc-x')).toBe(false);
  });
});
