'use server';

import { headers } from 'next/headers';
import { sha256Hex } from '@/lib/auth/crypto';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { checkEnquiry } from '@/lib/enquiry';
import { markEmailed, storeEnquiry } from '@/lib/enquiries-store';
import { isLocale } from '@/lib/content/shared';

export type ContactState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; error: string };

/**
 * Public contact form. Stores the enquiry first, then emails Sam: a mail failure must never
 * lose a customer. `ENQUIRY_TO` (a Worker secret, comma-separated allowed) is where it goes;
 * without it the enquiry is still stored and the failure is logged.
 *
 * Abuse: a honeypot, field limits, and a database-backed rate limit per sender (salted IP hash,
 * never the raw IP) plus a site-wide daily cap so a botnet cannot flood Sam's inbox or the
 * Resend quota (see `storeEnquiry`).
 */
export async function sendEnquiry(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: a real visitor never fills this hidden field.
  if (form.get('website')) return { status: 'sent' };

  const checked = checkEnquiry({
    name: form.get('name'),
    address: form.get('address'),
    postcode: form.get('postcode'),
    contact: form.get('contact'),
    notes: form.get('notes'),
  });
  if (!checked.ok) return { status: 'error', error: checked.error };

  const h = await headers();
  const requested = h.get('x-locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { name, address, postcode, contact, notes } = checked.value;

  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await sha256Hex(`${getEnv('SESSION_SECRET') ?? ''}|enquiry|${ip}`);

  const db = getDb();
  let id: string;
  try {
    const stored = await storeEnquiry(db, checked.value, { ipHash, locale });
    if (!stored.ok) return { status: 'error', error: 'rate' };
    id = stored.id;
  } catch (err) {
    console.error('[contact] could not store enquiry:', err);
    return { status: 'error', error: 'server' };
  }

  const to = getEnv('ENQUIRY_TO');
  if (!to) {
    console.error('[contact] enquiry', id, 'stored but not emailed: ENQUIRY_TO is missing');
    return { status: 'sent' };
  }

  try {
    const isEmail = contact.includes('@');
    // A plain Maps search link: no API key, opens the Maps app on a phone.
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${postcode}`)}`;
    const notesText = notes ? `\nNotes:\n${notes}\n` : '';
    const notesHtml = notes ? `<p><b>Notes:</b><br>${esc(notes).replace(/\n/g, '<br>')}</p>` : '';
    await sendMail({
      to,
      ...(isEmail ? { replyTo: contact } : {}),
      subject: `New enquiry from ${name}`,
      text: `Name: ${name}\nAddress: ${address}\nPostcode: ${postcode}\nContact: ${contact}\nMap: ${mapUrl}\n${notesText}\nSent from the website contact form.`,
      html: `<p><b>Name:</b> ${esc(name)}<br><b>Address:</b> ${esc(address)}<br><b>Postcode:</b> ${esc(postcode)}<br><b>Contact:</b> ${esc(contact)}<br><a href="${mapUrl}">Open in Google Maps</a></p>${notesHtml}<p>Sent from the website contact form.</p>`,
    });
    await markEmailed(db, id);
  } catch (err) {
    // Already stored; Sam can still be reached by the next look at the table.
    console.error('[contact] enquiry', id, 'stored but email failed:', err);
  }
  return { status: 'sent' };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
