'use server';

import { headers } from 'next/headers';
import { sha256Hex } from '@/lib/auth/crypto';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { RATE_LIMIT, checkEnquiry } from '@/lib/enquiry';
import { isLocale } from '@/lib/content/shared';

export type ContactState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; error: string };

/**
 * Public contact form. Stores the enquiry first, then emails Sam: a mail failure must never
 * lose a customer. `ENQUIRY_TO` (a Worker secret, comma-separated allowed) is where it goes;
 * without it the enquiry is still stored and the failure is logged.
 *
 * Abuse: a honeypot, field limits, and a D1-backed rate limit per sender (salted IP hash, never
 * the raw IP) plus a site-wide daily cap so a botnet cannot flood Sam's inbox or the Resend quota.
 */
export async function sendEnquiry(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: a real visitor never fills this hidden field.
  if (form.get('website')) return { status: 'sent' };

  const checked = checkEnquiry({
    name: form.get('name'),
    address: form.get('address'),
    contact: form.get('contact'),
    notes: form.get('notes'),
  });
  if (!checked.ok) return { status: 'error', error: checked.error };

  const h = await headers();
  const requested = h.get('x-locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { name, address, contact, notes } = checked.value;
  const now = Math.floor(Date.now() / 1000);

  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await sha256Hex(`${getEnv('SESSION_SECRET') ?? ''}|enquiry|${ip}`);

  let id: number;
  try {
    const db = getDb();
    const counts = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN ip_hash = ? AND created_at > ? THEN 1 ELSE 0 END) AS sender,
           COUNT(*) AS site
         FROM enquiries WHERE created_at > ?`,
      )
      .bind(ipHash, now - 3600, now - 86400)
      .first<{ sender: number | null; site: number }>();
    if ((counts?.sender ?? 0) >= RATE_LIMIT.perSenderPerHour || (counts?.site ?? 0) >= RATE_LIMIT.perSiteDay) {
      console.warn('[contact] rate limited', { sender: counts?.sender, site: counts?.site });
      return { status: 'error', error: 'rate' };
    }

    const res = await db
      .prepare(
        'INSERT INTO enquiries (created_at, name, address, contact, notes, locale, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(now, name, address, contact, notes, locale, ipHash)
      .run();
    id = Number(res.meta.last_row_id);
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
    const notesText = notes ? `\nNotes:\n${notes}\n` : '';
    const notesHtml = notes ? `<p><b>Notes:</b><br>${esc(notes).replace(/\n/g, '<br>')}</p>` : '';
    await sendMail({
      to,
      ...(isEmail ? { replyTo: contact } : {}),
      subject: `New enquiry from ${name}`,
      text: `Name: ${name}\nAddress: ${address}\nContact: ${contact}\n${notesText}\nSent from the website contact form.`,
      html: `<p><b>Name:</b> ${esc(name)}<br><b>Address:</b> ${esc(address)}<br><b>Contact:</b> ${esc(contact)}</p>${notesHtml}<p>Sent from the website contact form.</p>`,
    });
    await getDb().prepare('UPDATE enquiries SET emailed_at = ? WHERE id = ?').bind(now, id).run();
  } catch (err) {
    // Already stored; Sam can still be reached by the next look at the table.
    console.error('[contact] enquiry', id, 'stored but email failed:', err);
  }
  return { status: 'sent' };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
