// Pure helpers for phone numbers and the call / text / WhatsApp shortcuts (unit tested).

/**
 * UK-friendly normalising: "07717 842368", "+447717 842368" and "0044 7717 842368" all become
 * "+447717842368". Anything that does not look like a UK number is only tidied (spaces, dashes and
 * brackets removed), never rejected: a customer abroad is still a customer.
 */
export function normalisePhone(raw: string): string {
  let p = raw.replace(/[\s().-]/g, '');
  if (!p) return '';
  if (p.startsWith('0044')) p = `+44${p.slice(4)}`;
  else if (p.startsWith('44') && p.length >= 12) p = `+${p}`;
  else if (/^0\d{9,10}$/.test(p)) p = `+44${p.slice(1)}`;
  // "+44 (0) 7717..." typed with the redundant trunk zero.
  if (p.startsWith('+440')) p = `+44${p.slice(4)}`;
  return /^\+?\d+$/.test(p) ? p : raw.trim();
}

/** Digits only, no plus: what wa.me wants. */
const digits = (phone: string) => phone.replace(/\D/g, '');

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const smsLink = (phone: string, body = '') =>
  `sms:${phone.replace(/[^\d+]/g, '')}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
export const whatsappLink = (phone: string, body = '') =>
  `https://wa.me/${digits(phone)}${body ? `?text=${encodeURIComponent(body)}` : ''}`;

/** Only a mobile can be texted: UK mobiles are 07… / +447…. */
export const isUkMobile = (phone: string) => /^\+447\d{9}$/.test(normalisePhone(phone));
