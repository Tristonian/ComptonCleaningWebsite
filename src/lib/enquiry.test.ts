import { describe, expect, it } from 'vitest';
import { checkEnquiry, formatPhone, normaliseEmail, normalisePhone, normalisePostcode } from './enquiry';

const good = { name: 'Jo', address: '1 High St', postcode: 'bs161aa', phone: '07700 900123', email: '', service: 'window-cleaning' };

describe('checkEnquiry', () => {
  it('accepts a phone only, an email only, or both', () => {
    expect(checkEnquiry(good).ok).toBe(true);
    expect(checkEnquiry({ ...good, phone: '', email: 'Jo@Example.com' }).ok).toBe(true);
    const both = checkEnquiry({ ...good, email: 'jo@example.com' });
    expect(both.ok && both.value).toMatchObject({ phone: '+447700900123', email: 'jo@example.com' });
  });
  it('needs at least one way to reach them', () => {
    expect(checkEnquiry({ ...good, phone: '', email: '' })).toEqual({ ok: false, error: 'contact-missing' });
  });
  it('rejects missing fields', () => {
    expect(checkEnquiry({ ...good, name: '  ' })).toEqual({ ok: false, error: 'missing' });
    expect(checkEnquiry({ ...good, address: '' })).toEqual({ ok: false, error: 'missing' });
    expect(checkEnquiry({})).toEqual({ ok: false, error: 'missing' });
  });
  it('names the field that is wrong', () => {
    expect(checkEnquiry({ ...good, phone: '12345' })).toEqual({ ok: false, error: 'phone' });
    expect(checkEnquiry({ ...good, email: 'not-an-email' })).toEqual({ ok: false, error: 'email' });
    expect(checkEnquiry({ ...good, postcode: 'hello' })).toEqual({ ok: false, error: 'postcode' });
  });
  it('a bad email is rejected even when the phone is fine', () => {
    expect(checkEnquiry({ ...good, email: 'jo@' }).ok).toBe(false);
  });
  it('needs a real service, and ignores a bad or blank source', () => {
    expect(checkEnquiry({ ...good, service: '' })).toEqual({ ok: false, error: 'service' });
    expect(checkEnquiry({ ...good, service: 'tarmac' })).toEqual({ ok: false, error: 'service' });
    const noSource = checkEnquiry({ ...good, source: 'nonsense' });
    expect(noSource.ok && noSource.value).toMatchObject({ service: 'window-cleaning', source: '' });
    const withSource = checkEnquiry({ ...good, source: 'google-maps' });
    expect(withSource.ok && withSource.value.source).toBe('google-maps');
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

describe('normalisePostcode', () => {
  it('is normalised to upper case with one space', () => {
    expect(normalisePostcode('bs161aa')).toBe('BS16 1AA');
    expect(normalisePostcode(' np16  5xy ')).toBe('NP16 5XY');
    expect(normalisePostcode('M1 1AE')).toBe('M1 1AE');
  });
  it('rejects things that are not UK postcodes', () => {
    for (const bad of ['hello', '12345', 'BS16', 'BS16 1A', '', 'BS16 1AAA']) expect(normalisePostcode(bad)).toBe('');
  });
});

describe('normalisePhone', () => {
  it('accepts UK mobiles and landlines in common spellings', () => {
    for (const ok of ['07700 900123', '07700900123', '+44 7700 900123', '+447700900123', '0044 7700 900123', '(07700) 900-123', '447700900123']) {
      expect(normalisePhone(ok)).toBe('+447700900123');
    }
    expect(normalisePhone('0117 496 0123')).toBe('+441174960123');
    expect(normalisePhone('020 7946 0000')).toBe('+442079460000');
  });
  it('rejects the wrong length, letters, pagers, personal numbers and obvious fakes', () => {
    for (const bad of ['', '12345', '0770090012', '077009001234', 'abc', '07700 90012x', '07600 900123', '07000 900123', '00000000000', '07777777777', '+1 202 555 0100', '800 123 4567']) {
      expect(normalisePhone(bad)).toBe('');
    }
  });
  it('formats a mobile for people', () => {
    expect(formatPhone('+447700900123')).toBe('07700 900123');
    expect(formatPhone('+441174960123')).toBe('01174960123');
  });
});

describe('normaliseEmail', () => {
  it('accepts normal addresses and lower-cases them', () => {
    expect(normaliseEmail(' Jo.Bloggs+win@Example.co.uk ')).toBe('jo.bloggs+win@example.co.uk');
    expect(normaliseEmail("o'neil@example.com")).toBe("o'neil@example.com");
  });
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'jo', 'jo@', '@example.com', 'jo@example', 'jo@@example.com', 'jo bloggs@example.com', '.jo@example.com', 'jo.@example.com', 'jo..b@example.com', 'jo@-example.com', 'jo@example.c', 'a'.repeat(65) + '@example.com']) {
      expect(normaliseEmail(bad)).toBe('');
    }
  });
});
