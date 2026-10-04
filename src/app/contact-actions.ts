'use server';

import { headers } from 'next/headers';
import { sha256Hex } from '@/lib/auth/crypto';
import { getDb } from '@/lib/db';
import { getEnv, siteUrl } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { checkEnquiry } from '@/lib/enquiry';
import { directionsLink, mapsLink } from '@/lib/geo';
import { buildEnquiryEmail } from '@/lib/enquiry-email';
import { fetchMapImage, postcodeCentre } from '@/lib/map-image';
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
    lat: form.get('lat'),
    lng: form.get('lng'),
  });
  if (!checked.ok) return { status: 'error', error: checked.error };

  const h = await headers();
  const requested = h.get('x-locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { address, postcode, contact, point } = checked.value;

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
    // The map picture: the confirmed pin, else the centre of the postcode (labelled approximate).
    const centre = point ? null : await postcodeCentre(postcode);
    const mapPoint = point ?? centre;
    const image = mapPoint ? await fetchMapImage(mapPoint, getEnv('MAPBOX_TOKEN'), siteUrl()) : null;
    const email = buildEnquiryEmail({
      input: checked.value,
      mapUrl: mapsLink({ address, postcode, point }),
      directionsUrl: directionsLink({ address, postcode, point }),
      pinKind: point ? 'pin' : centre ? 'postcode' : 'none',
      hasMapImage: Boolean(image),
    });
    await sendMail({
      to,
      ...(isEmail ? { replyTo: contact } : {}),
      ...email,
      ...(image ? { inline: [image] } : {}),
    });
    await markEmailed(db, id);
  } catch (err) {
    // Already stored; Sam can still be reached by the next look at the table.
    console.error('[contact] enquiry', id, 'stored but email failed:', err);
  }
  return { status: 'sent' };
}
