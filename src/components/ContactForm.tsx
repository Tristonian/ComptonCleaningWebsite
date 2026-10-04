'use client';

import dynamic from 'next/dynamic';
import { useActionState, useRef, useState } from 'react';
import { Ed } from '@/components/Ed';
import { sendEnquiry, type ContactState } from '@/app/contact-actions';
import { isPlausibleUkPoint, type LatLng } from '@/lib/geo';

// Loaded only when a pin is first shown: the map library is large.
const PinMap = dynamic(() => import('@/components/PinMap').then((m) => m.PinMap), { ssr: false });

const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

type Locating = 'idle' | 'working' | 'denied' | 'failed';

/**
 * Contact form with an optional location helper: "Use my location" (browser geolocation, then a
 * free postcode lookup) and a draggable Mapbox pin to confirm the spot. Everything about location
 * is optional: a visitor can ignore it, or the helper can fail, and typing still works.
 */
export function ContactForm({ mapboxToken }: { mapboxToken?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendEnquiry, { status: 'idle' });
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [mapBroken, setMapBroken] = useState(false);
  const [locating, setLocating] = useState<Locating>('idle');
  const lookedUp = useRef('');

  if (state.status === 'sent') {
    return (
      <Ed id="contact.form.thanks" as="p" className="rounded-xl bg-brand/10 p-4 font-semibold text-brand-deep">
        {'Thanks, we’ll be in touch soon.'}
      </Ed>
    );
  }

  /** Turn a typed postcode into a point for the map (postcodes.io: free, no key). */
  async function lookUpPostcode(raw: string) {
    const clean = raw.trim().toUpperCase().replace(/\s+/g, '');
    if (!POSTCODE.test(clean) || lookedUp.current === clean) return;
    lookedUp.current = clean;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
      if (!res.ok) return;
      const { result } = (await res.json()) as { result?: { latitude: number; longitude: number } };
      if (result && isPlausibleUkPoint(result.latitude, result.longitude)) {
        setPoint({ lat: result.latitude, lng: result.longitude });
      }
    } catch {
      // Offline or blocked: the typed postcode is still submitted.
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) return setLocating('failed');
    setLocating('working');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isPlausibleUkPoint(here.lat, here.lng)) return setLocating('failed');
        setPoint(here);
        setLocating('idle');
        await fillFromPoint(here, { replaceAddress: false });
      },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  /** Fill the postcode (and an empty address) from a point: postcodes.io, then Mapbox. */
  async function fillFromPoint(p: LatLng, opts: { replaceAddress: boolean }) {
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes?lon=${p.lng}&lat=${p.lat}&limit=1&radius=300`,
      );
      if (res.ok) {
        const { result } = (await res.json()) as { result?: { postcode: string }[] | null };
        const found = result?.[0]?.postcode;
        if (found) {
          lookedUp.current = found.replace(/\s+/g, '');
          setPostcode(found);
        }
      }
    } catch {
      // Ignore: the visitor can type it.
    }
    if (!mapboxToken || (address.trim() && !opts.replaceAddress)) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.lng}&latitude=${p.lat}&types=address&limit=1&access_token=${encodeURIComponent(mapboxToken)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { features?: { properties?: { name?: string } }[] };
      const street = json.features?.[0]?.properties?.name;
      if (street) setAddress(street);
    } catch {
      // Ignore.
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.name">Name</Ed>
        <input name="name" required maxLength={100} autoComplete="name" className={field} />
      </label>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating === 'working'}
        className="rounded-xl px-4 py-3 font-bold text-brand-deep ring-2 ring-brand-deep disabled:opacity-60"
      >
        <Ed id="contact.loc.use">Use my location</Ed>
      </button>
      {locating === 'denied' && (
        <Ed id="contact.loc.denied" as="p" className="text-sm text-ink/80">
          Location is blocked in your browser. No problem: type your address and postcode instead.
        </Ed>
      )}
      {locating === 'failed' && (
        <Ed id="contact.loc.failed" as="p" className="text-sm text-ink/80">
          We couldn’t find you just now. Please type your address and postcode instead.
        </Ed>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.address">Address</Ed>
        <input
          name="address"
          required
          maxLength={300}
          autoComplete="street-address"
          className={field}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.postcode">Postcode</Ed>
        <input
          name="postcode"
          required
          maxLength={10}
          autoComplete="postal-code"
          autoCapitalize="characters"
          className={field}
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value);
            void lookUpPostcode(e.target.value);
          }}
          onBlur={(e) => void lookUpPostcode(e.target.value)}
        />
      </label>

      {point && mapboxToken && !mapBroken && (
        <div className="flex flex-col gap-2">
          <PinMap
            token={mapboxToken}
            point={point}
            onMove={(p) => {
              setPoint(p);
              void fillFromPoint(p, { replaceAddress: false });
            }}
            onFail={() => setMapBroken(true)}
          />
          <Ed id="contact.loc.drag" as="p" className="text-sm text-ink/80">
            Drag the pin to your front door, or tap the map. It helps Sam find you.
          </Ed>
        </div>
      )}
      <input type="hidden" name="lat" value={point ? String(point.lat) : ''} />
      <input type="hidden" name="lng" value={point ? String(point.lng) : ''} />

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.contact">Contact number / email</Ed>
        <input name="contact" required maxLength={120} autoComplete="tel" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.notes">Notes (optional)</Ed>
        <textarea name="notes" rows={4} maxLength={1000} className={field} />
      </label>
      {/* Honeypot, hidden from people and assistive tech. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.status === 'error' && state.error === 'rate' && (
        <Ed id="contact.form.rate" as="p" className="text-sm font-semibold text-red-700">
          Too many messages just now. Please give us a call or text instead.
        </Ed>
      )}
      {state.status === 'error' && state.error === 'postcode' && (
        <Ed id="contact.form.postcode.error" as="p" className="text-sm font-semibold text-red-700">
          Please enter a full UK postcode, like BS16 1AA.
        </Ed>
      )}
      {state.status === 'error' && state.error !== 'rate' && state.error !== 'postcode' && (
        <Ed id="contact.form.error" as="p" className="text-sm font-semibold text-red-700">
          Please check your details and try again, or give us a call.
        </Ed>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white disabled:opacity-60"
      >
        <Ed id="contact.form.submit">Send</Ed>
      </button>
    </form>
  );
}
