import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { SERVICES } from './enquiry-options';
import { getOptions, replaceOptions, resetOptions } from './form-options';
import { checkEnquiry } from './enquiry';

let db: Db;
beforeEach(async () => {
  ({ db } = await makeTestDb());
});

describe('form options', () => {
  it('uses the defaults until a list is saved, then the saved list in order', async () => {
    expect(await getOptions('service', db)).toEqual({ options: [...SERVICES], edited: false });
    const r = await replaceOptions(
      { list: 'service', rows: [{ value: 'gutter-cleaning', en: 'Gutters', cy: '' }, { en: 'Pressure washing', cy: 'Golchi' }, { value: 'window-cleaning', en: 'Windows', cy: 'Ffenestri' }], by: 's' },
      db,
    );
    expect(r.ok).toBe(true);
    const { options, edited } = await getOptions('service', db);
    expect(edited).toBe(true);
    expect(options.map((o) => o.en)).toEqual(['Gutters', 'Pressure washing', 'Windows']);
    expect(options[0]).toMatchObject({ value: 'gutter-cleaning', cy: 'Gutters' }); // Welsh falls back to English
    expect(options[1].value).toMatch(/^opt-/);
    expect(options[2].value).toBe('window-cleaning'); // built-in keys survive a rename
  });

  it('lists are independent, forged keys are replaced, and bad input is refused', async () => {
    await replaceOptions({ list: 'source', rows: [{ value: 'custom:evil', en: 'Flyer', cy: '' }], by: 's' }, db);
    const { options } = await getOptions('source', db);
    expect(options[0].value).toMatch(/^opt-/);
    expect((await getOptions('service', db)).edited).toBe(false);
    expect((await replaceOptions({ list: 'service', rows: [], by: 's' }, db)).ok).toBe(false);
    expect((await replaceOptions({ list: 'service', rows: [{ en: ' ', cy: '' }], by: 's' }, db)).ok).toBe(false);
    expect((await replaceOptions({ list: 'nope', rows: [{ en: 'x', cy: '' }], by: 's' }, db)).ok).toBe(false);
  });

  it('reset goes back to the defaults', async () => {
    await replaceOptions({ list: 'service', rows: [{ en: 'Only this', cy: '' }], by: 's' }, db);
    await resetOptions({ list: 'service', by: 's' }, db);
    expect((await getOptions('service', db)).edited).toBe(false);
  });
});

describe('checkEnquiry with live lists', () => {
  const base = { name: 'A', address: '1 High St', postcode: 'BS16 1AA', phone: '07700 900123', service: 'opt-abc12345', source: 'opt-zzz' };
  it('accepts a service from the supplied validator and drops an unknown source', () => {
    const r = checkEnquiry(base, { isService: (v) => v === 'opt-abc12345', isSource: () => false });
    expect(r.ok && r.value.service).toBe('opt-abc12345');
    expect(r.ok && r.value.source).toBe('');
  });
  it('still rejects an unknown service', () => {
    expect(checkEnquiry(base, { isService: () => false })).toEqual({ ok: false, error: 'service' });
  });
});
