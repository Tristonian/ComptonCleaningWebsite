import { isService, isSource } from './enquiry-options';
import { parsePoint, type LatLng } from './geo';

/**
 * Pure validation for the contact form, shared by the server action, the form (instant feedback)
 * and tests. Nothing here touches the network: the lookups that need it live in verify.ts.
 */

export interface EnquiryInput {
  name: string;
  address: string;
  /** UK postcode, normalised to upper case with one space (BS16 1AA). */
  postcode: string;
  /** UK phone in international form (+447700900123), or '' if none was given. */
  phone: string;
  /** Lower-cased email address, or '' if none was given. At least one of phone/email is required. */
  email: string;
  /** What they want done: a key from SERVICES (required). */
  service: string;
  /** How they found Sam: a key from SOURCES, or '' if they did not say. */
  source: string;
  /** Optional free text from the customer (windows, access, gate codes, best times...). */
  notes: string;
  /** The pin the customer confirmed (or their detected location). Optional; implausible values are dropped. */
  point: LatLng | null;
}

export type EnquiryError = 'missing' | 'service' | 'contact-missing' | 'phone' | 'email' | 'postcode' | 'too-long';
export type EnquiryCheck = { ok: true; value: EnquiryInput } | { ok: false; error: EnquiryError };

/** Per sender (salted IP hash) and across the whole site. Generous for people, tight for bots. */
export const RATE_LIMIT = { perSenderPerHour: 3, perSiteDay: 40 } as const;

const MAX = { name: 100, address: 300, postcode: 10, phone: 30, email: 254, notes: 1000 } as const;

/** The server passes validators built from the (editable) option lists; the default is the lists in code. */
export interface OptionValidators {
  isService?: (v: string) => boolean;
  isSource?: (v: string) => boolean;
}

export function checkEnquiry(raw: Record<string, unknown>, valid: OptionValidators = {}): EnquiryCheck {
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  // Notes keep their line breaks (collapsed to at most one blank line), unlike the one-line fields.
  const notes = (typeof raw.notes === 'string' ? raw.notes : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const name = clean(raw.name);
  const address = clean(raw.address);
  const rawPostcode = clean(raw.postcode);
  const rawPhone = clean(raw.phone);
  const rawEmail = clean(raw.email);

  if (!name || !address || !rawPostcode) return { ok: false, error: 'missing' };
  const service = clean(raw.service);
  if (!(valid.isService ?? isService)(service)) return { ok: false, error: 'service' };
  // An unknown or blank source is simply "didn't say": it is optional and never worth refusing for.
  const rawSource = clean(raw.source);
  const source = (valid.isSource ?? isSource)(rawSource) ? rawSource : '';
  if (!rawPhone && !rawEmail) return { ok: false, error: 'contact-missing' };
  if (
    name.length > MAX.name ||
    address.length > MAX.address ||
    rawPostcode.length > MAX.postcode ||
    rawPhone.length > MAX.phone ||
    rawEmail.length > MAX.email ||
    notes.length > MAX.notes
  ) {
    return { ok: false, error: 'too-long' };
  }

  const postcode = normalisePostcode(rawPostcode);
  if (!postcode) return { ok: false, error: 'postcode' };
  const phone = rawPhone ? normalisePhone(rawPhone) : '';
  if (rawPhone && !phone) return { ok: false, error: 'phone' };
  const email = rawEmail ? normaliseEmail(rawEmail) : '';
  if (rawEmail && !email) return { ok: false, error: 'email' };

  return {
    ok: true,
    value: { name, address, postcode, phone, email, service, source, notes, point: parsePoint(raw.lat, raw.lng) },
  };
}

const POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;

/** "bs161aa" -> "BS16 1AA"; anything that is not a UK postcode shape -> '' (the caller rejects). */
export function normalisePostcode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const m = POSTCODE.exec(raw.trim().toUpperCase());
  return m ? `${m[1]} ${m[2]}` : '';
}

/**
 * UK numbers only (Sam works locally): "07700 900123", "+44 7700 900123", "0044 117 496 0000"
 * -> "+447700900123". Returns '' for anything that is not a plausible UK mobile or landline.
 * Mobiles are 07 followed by 1-5 or 7-9 (070 personal and 076 pager numbers are refused);
 * landlines are 01, 02 or 03. Numbers that are one repeated digit are refused.
 */
export function normalisePhone(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if (/[^\d\s()+.\-]/.test(s)) return '';
  s = s.replace(/[\s().\-]/g, '');
  if (s.startsWith('+44')) s = s.slice(3);
  else if (s.startsWith('0044')) s = s.slice(4);
  else if (s.startsWith('44') && s.length >= 12) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);
  else return ''; // no recognisable UK prefix
  if (s.startsWith('0') || s.includes('+') || !/^\d{10}$/.test(s)) return '';
  const ok = /^7[1-57-9]\d{8}$/.test(s) || /^[123]\d{9}$/.test(s);
  if (!ok || /^(\d)\1+$/.test(s)) return '';
  return `+44${s}`;
}

/** "+447700900123" -> "07700 900123" for people. Landline spacing varies by area, so those stay as 0xxxxxxxxxx. */
export function formatPhone(e164: string): string {
  const m = /^\+44(7\d{3})(\d{6})$/.exec(e164);
  if (m) return `0${m[1]} ${m[2]}`;
  return e164.startsWith('+44') ? `0${e164.slice(3)}` : e164;
}

/**
 * A practical email check, not the whole RFC: one @, a dotted domain with a 2+ letter ending, no
 * spaces, no leading/trailing/double dots, sensible lengths. Returns the lower-cased address or ''.
 */
export function normaliseEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim().toLowerCase();
  if (s.length > 254 || /\s/.test(s)) return '';
  const m = /^([a-z0-9._%+'\-]+)@([a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,})$/.exec(s);
  if (!m) return '';
  const [, local] = m;
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return '';
  return s;
}
