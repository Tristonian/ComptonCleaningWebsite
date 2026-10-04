/** Pure validation for the contact form, shared by the server action and its tests. */

export interface EnquiryInput {
  name: string;
  address: string;
  /** UK postcode, normalised to upper case with one space (BS16 1AA). */
  postcode: string;
  contact: string;
  /** Optional free text from the customer (windows, access, gate codes, best times...). */
  notes: string;
}

export type EnquiryCheck = { ok: true; value: EnquiryInput } | { ok: false; error: string };

/** Per sender (salted IP hash) and across the whole site. Generous for people, tight for bots. */
export const RATE_LIMIT = { perSenderPerHour: 3, perSiteDay: 40 } as const;

const MAX = { name: 100, address: 300, postcode: 10, contact: 120, notes: 1000 } as const;

export function checkEnquiry(raw: Record<string, unknown>): EnquiryCheck {
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  // Notes keep their line breaks (collapsed to at most one blank line), unlike the one-line fields.
  const notes = (typeof raw.notes === 'string' ? raw.notes : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const value: EnquiryInput = {
    name: clean(raw.name),
    address: clean(raw.address),
    postcode: normalisePostcode(raw.postcode),
    contact: clean(raw.contact),
    notes,
  };
  if (!value.name || !value.address || !value.contact || !String(raw.postcode ?? '').trim()) {
    return { ok: false, error: 'missing' };
  }
  if (!value.postcode) return { ok: false, error: 'postcode' };
  if (
    value.name.length > MAX.name ||
    value.address.length > MAX.address ||
    value.contact.length > MAX.contact ||
    value.notes.length > MAX.notes
  ) {
    return { ok: false, error: 'too-long' };
  }
  // Either an email address or something that holds a phone number's worth of digits.
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.contact);
  const digits = value.contact.replace(/\D/g, '');
  if (!isEmail && (digits.length < 10 || digits.length > 15)) return { ok: false, error: 'contact' };
  return { ok: true, value };
}

const POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;

/** "bs161aa" -> "BS16 1AA"; anything that is not a UK postcode shape -> '' (the caller rejects). */
export function normalisePostcode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const m = POSTCODE.exec(raw.trim().toUpperCase());
  return m ? `${m[1]} ${m[2]}` : '';
}
