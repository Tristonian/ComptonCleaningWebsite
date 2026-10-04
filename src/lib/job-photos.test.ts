import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { createCustomer, deleteCustomer } from './customers';
import { addJobPhoto, deleteJobPhoto, MAX_JOB_PHOTOS, photosByJob, unreferenced } from './job-photos';
import { deleteJob, listJobs, recordJob } from './jobs';
import { deleteBlock } from './blocks';

const TODAY = '2026-10-04';
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
let db: Db;
let cid: string;
let jobId: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  const c = await createCustomer({ name: 'Test Person', address: '1 Road', price: '15', frequencyWeeks: 4 }, 's', db);
  if (!c.ok) throw new Error('create');
  cid = c.id;
  const r = await recordJob(cid, { status: 'done', doneOn: TODAY, price: '15', paymentMethod: 'cash', paid: true }, 's', db, TODAY);
  if (!r.ok) throw new Error('job');
  jobId = (await listJobs(cid, db))[0].id;
});

const add = (hash = H1, id = jobId) => addJobPhoto({ jobId: id, hash, width: 800, height: 600, by: 's' }, db);

describe('visit photos', () => {
  it('adds photos in order and lists them on the visit', async () => {
    expect((await add(H1)).ok).toBe(true);
    expect((await add(H2)).ok).toBe(true);
    expect((await listJobs(cid, db))[0].photos.map((p) => p.hash)).toEqual([H1, H2]);
  });

  it('refuses a bad hash, an unknown visit and more than the cap', async () => {
    expect((await add('nope')).ok).toBe(false);
    expect((await add(H1, '99999')).ok).toBe(false);
    for (let i = 0; i < MAX_JOB_PHOTOS; i++) expect((await add(String(i).repeat(64))).ok).toBe(true);
    expect((await add(H1)).ok).toBe(false);
  });

  it('only reports a hash as orphaned when no visit and no page block still uses it', async () => {
    await add(H1);
    const second = await recordJob(cid, { status: 'done', doneOn: '2026-09-01', price: '15', paymentMethod: 'cash', paid: true }, 's', db, TODAY);
    expect(second.ok).toBe(true);
    const other = (await listJobs(cid, db)).find((j) => j.doneOn === '2026-09-01')!.id;
    await add(H1, other);
    const photos = await photosByJob([jobId], db);
    const del = await deleteJobPhoto(photos.get(jobId)![0].id, 's', db);
    expect(del).toEqual({ ok: true, orphans: [] }); // still on the other visit
    const left = await photosByJob([other], db);
    expect(await deleteJobPhoto(left.get(other)![0].id, 's', db)).toEqual({ ok: true, orphans: [H1] });
  });

  it('deleting a visit returns the hashes nothing else uses', async () => {
    await add(H1);
    await add(H2);
    expect(await deleteJob(jobId, 's', db)).toEqual({ ok: true, orphans: [H1, H2] });
  });

  it('deleting a customer returns their photo hashes, and the rows are gone', async () => {
    await add(H1);
    expect(await deleteCustomer(cid, 's', db)).toEqual({ ok: true, orphans: [H1] });
    expect(await db.query('SELECT 1 FROM job_photos')).toHaveLength(0);
  });

  it('keeps an object that a page block also uses', async () => {
    await db.query("INSERT INTO site_images (hash, content_type, width, height, kind, uploaded_by) VALUES ($1, 'image/webp', 8, 8, 'photo', 's')", [H1]);
    await db.query("INSERT INTO page_blocks (zone, position, kind, image_hash, created_by) VALUES ('intro', 1, 'image', $1, 's')", [H1]);
    await add(H1);
    expect(await unreferenced([H1], db)).toEqual([]);
    expect(await deleteJob(jobId, 's', db)).toEqual({ ok: true, orphans: [] });
  });

  it('a page block delete keeps the object while a visit photo uses it', async () => {
    await db.query("INSERT INTO site_images (hash, content_type, width, height, kind, uploaded_by) VALUES ($1, 'image/webp', 8, 8, 'photo', 's')", [H1]);
    const b = await db.query<{ id: string }>("INSERT INTO page_blocks (zone, position, kind, image_hash, created_by) VALUES ('intro', 1, 'image', $1, 's') RETURNING id::text AS id", [H1]);
    await add(H1);
    expect(await deleteBlock({ id: b[0].id, by: 's' }, db)).toEqual({ ok: true, orphanHash: null });
  });

  it('audit rows hold ids only', async () => {
    await add(H1);
    const rows = await db.query<{ action: string; detail: unknown }>("SELECT action, detail FROM audit_log WHERE action = 'job_photo_added'");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0].detail)).not.toContain(H1);
  });
});
