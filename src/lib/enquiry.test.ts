import { describe, expect, it } from 'vitest';
import { checkEnquiry } from './enquiry';

const good = { name: 'Jo', address: '1 High St', postcode: 'bs161aa', contact: '07700 900123' };

describe('checkEnquiry', () => {
  it('accepts a phone number or an email', () => {
    expect(checkEnquiry(good).ok).toBe(true);
    expect(checkEnquiry({ ...good, contact: 'jo@example.com' }).ok).toBe(true);
  });
  it('rejects missing fields', () => {
    expect(checkEnquiry({ ...good, name: '  ' })).toEqual({ ok: false, error: 'missing' });
    expect(checkEnquiry({})).toEqual({ ok: false, error: 'missing' });
  });
  it('rejects a contact that is neither', () => {
    expect(checkEnquiry({ ...good, contact: 'call me' })).toEqual({ ok: false, error: 'contact' });
  });
  it('rejects oversized input', () => {
    expect(checkEnquiry({ ...good, name: 'x'.repeat(101) })).toEqual({ ok: false, error: 'too-long' });
    expect(checkEnquiry({ ...good, notes: 'x'.repeat(1001) })).toEqual({ ok: false, error: 'too-long' });
  });
  it('notes are optional and keep their line breaks', () => {
    const none = checkEnquiry(good);
    expect(none.ok && none.value.notes).toBe('');
    const some = checkEnquiry({ ...good, notes: 'Side gate\r\n\r\n\r\n\r\nDogs  in garden ' });
    expect(some.ok && some.value.notes).toBe('Side gate\n\nDogs in garden');
  });
});

describe('postcode', () => {
  it('is normalised to upper case with one space', () => {
    const r = checkEnquiry(good);
    expect(r.ok && r.value.postcode).toBe('BS16 1AA');
    const r2 = checkEnquiry({ ...good, postcode: ' np16  5xy ' });
    expect(r2.ok && r2.value.postcode).toBe('NP16 5XY');
  });
  it('is required and must look like a UK postcode', () => {
    expect(checkEnquiry({ ...good, postcode: '' })).toEqual({ ok: false, error: 'missing' });
    expect(checkEnquiry({ ...good, postcode: 'hello' })).toEqual({ ok: false, error: 'postcode' });
    expect(checkEnquiry({ ...good, postcode: '12345' })).toEqual({ ok: false, error: 'postcode' });
  });
});
