import type { ReactNode } from 'react';
import { Ed } from '@/components/Ed';
import type { LatLng } from '@/lib/geo';

export interface SentSnapshot {
  name: string;
  /** Already a human label in their language, or ''. */
  service: string;
  source: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  notes: string;
  pin: LatLng | null;
}

/** The thank-you: confirms receipt and shows back exactly what was sent, with the pin on a small map. */
export function ContactSent({ snapshot, mapboxToken }: { snapshot: SentSnapshot | null; mapboxToken?: string }) {
  const row = (label: ReactNode, value: string) =>
    value ? (
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">{label}</dt>
        <dd className="whitespace-pre-line break-words text-base text-ink">{value}</dd>
      </div>
    ) : null;
  const mapSrc =
    snapshot?.pin && mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+085478(${snapshot.pin.lng},${snapshot.pin.lat})/${snapshot.pin.lng},${snapshot.pin.lat},16,0/600x300@2x?access_token=${encodeURIComponent(mapboxToken)}`
      : null;

  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl bg-brand/10 p-4">
      <Ed id="contact.form.thanks" as="p" className="text-lg font-bold text-brand-deep">
        {'Thanks, we’ll be in touch soon.'}
      </Ed>
      {snapshot && (
        <>
          <Ed id="contact.sent.title" as="p" className="text-sm font-semibold text-ink/80">
            Here’s what you sent us:
          </Ed>
          <dl className="flex flex-col gap-3 rounded-lg bg-white p-3 ring-1 ring-ink/10">
            {row(<Ed id="contact.form.name">Name</Ed>, snapshot.name)}
            {row(<Ed id="contact.form.service">What service are you interested in?</Ed>, snapshot.service)}
            {row(<Ed id="contact.form.source">Where did you hear about us? (optional)</Ed>, snapshot.source)}
            {row(<Ed id="contact.form.address">Address</Ed>, snapshot.address)}
            {row(<Ed id="contact.form.postcode">Postcode</Ed>, snapshot.postcode)}
            {row(<Ed id="contact.form.phone">Phone</Ed>, snapshot.phone)}
            {row(<Ed id="contact.form.email">Email</Ed>, snapshot.email)}
            {row(<Ed id="contact.form.notes">Notes (optional)</Ed>, snapshot.notes)}
          </dl>
          {mapSrc && (
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapSrc}
                alt=""
                width={600}
                height={300}
                className="w-full rounded-xl ring-1 ring-ink/20"
              />
              <Ed id="contact.sent.pin" as="p" className="text-sm font-semibold text-brand-deep">
                ✓ The pin you confirmed on the map
              </Ed>
            </div>
          )}
          <Ed id="contact.sent.reply" as="p" className="text-sm text-ink/80">
            We’ll reply using the phone number or email above. If anything is wrong, just call or text us.
          </Ed>
        </>
      )}
    </div>
  );
}
