'use client';

import { useState } from 'react';
import { isPlausibleUkPoint } from '@/lib/geo';
import type { RoundRow } from '@/lib/customers';

type Initial = {
  id?: string;
  name?: string;
  address?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  notes?: string;
  price?: string;
  frequencyWeeks?: string;
  preferredPayment?: string;
  roundIds?: string[];
  lastCleaned?: string;
};

const field = 'mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal text-ink focus:border-brand focus:outline-none';
const label = 'block text-sm font-semibold text-ink/80';

/**
 * One form for adding and editing a customer. "Grab location" is the quick path: stand outside, tap it,
 * and the street and postcode fill in, then name, price and frequency. The point is kept in hidden
 * fields so the job can be navigated to later. Unlike the public form there is no "confirm the pin"
 * step: this is Sam standing at the house, not a visitor guessing.
 */
export function CustomerForm({
  action,
  initial = {},
  rounds,
  payments,
  mapboxToken,
  submitLabel,
}: {
  action: (form: FormData) => Promise<void>;
  initial?: Initial;
  rounds: RoundRow[];
  payments: { key: string; label: string }[];
  mapboxToken?: string;
  submitLabel: string;
}) {
  const [address, setAddress] = useState(initial.address ?? '');
  const [postcode, setPostcode] = useState(initial.postcode ?? '');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'denied' | 'failed' | 'done'>('idle');
  const [picked, setPicked] = useState<string[]>(initial.roundIds ?? []);

  function grab() {
    if (!('geolocation' in navigator)) return setState('failed');
    setState('working');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isPlausibleUkPoint(here.lat, here.lng)) return setState('failed');
        setPoint(here);
        try {
          const res = await fetch(`https://api.postcodes.io/postcodes?lon=${here.lng}&lat=${here.lat}&limit=1&radius=300`);
          if (res.ok) {
            const { result } = (await res.json()) as { result?: { postcode: string }[] | null };
            if (result?.[0]?.postcode) setPostcode(result[0].postcode);
          }
        } catch {
          // The postcode can be typed.
        }
        if (mapboxToken) {
          try {
            const res = await fetch(
              `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${here.lng}&latitude=${here.lat}&types=address&limit=1&access_token=${encodeURIComponent(mapboxToken)}`,
            );
            if (res.ok) {
              const json = (await res.json()) as { features?: { properties?: { name?: string } }[] };
              const street = json.features?.[0]?.properties?.name;
              if (street) setAddress(street);
            }
          } catch {
            // The address can be typed.
          }
        }
        setState('done');
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <form action={action} className="flex flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {point && (
        <>
          <input type="hidden" name="lat" value={point.lat} />
          <input type="hidden" name="lng" value={point.lng} />
        </>
      )}

      <div>
        <button
          type="button"
          onClick={grab}
          disabled={state === 'working'}
          className="w-full rounded-xl bg-brand-deep px-4 py-4 text-lg font-black text-white disabled:opacity-60"
        >
          {state === 'working' ? 'Finding you…' : '📍 Grab location'}
        </button>
        <p role="status" className="mt-1 text-sm text-ink/70">
          {state === 'done' && 'Got it. Check the street and postcode below.'}
          {state === 'denied' && 'Location is blocked. Allow it for this site in the browser settings, or type the address.'}
          {state === 'failed' && 'Could not get a location. Type the address instead.'}
        </p>
      </div>

      <label className={label}>
        Name
        <input name="name" required defaultValue={initial.name} autoComplete="off" className={field} />
      </label>
      <label className={label}>
        Address
        <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" className={field} />
      </label>
      <label className={label}>
        Postcode
        <input name="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} autoComplete="off" className={`${field} uppercase`} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Price (£)
          <input name="price" inputMode="decimal" defaultValue={initial.price} placeholder="15" className={field} />
        </label>
        <label className={label}>
          Every (weeks)
          <input name="frequencyWeeks" inputMode="numeric" defaultValue={initial.frequencyWeeks} placeholder="4" className={field} />
        </label>
      </div>

      <label className={label}>
        Phone
        <input name="phone" type="tel" defaultValue={initial.phone} autoComplete="off" className={field} />
      </label>

      {rounds.length > 0 && (
        <fieldset>
          <legend className={label}>Rounds (a customer can be in more than one)</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {rounds.map((r) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ring-1 ${
                  picked.includes(r.id) ? 'bg-brand-deep text-white ring-brand-deep' : 'bg-white text-brand-deep ring-brand-deep/40'
                }`}
              >
                <input
                  type="checkbox"
                  name="roundIds"
                  value={r.id}
                  checked={picked.includes(r.id)}
                  onChange={() => toggle(r.id)}
                  className="sr-only"
                />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10" open={Boolean(initial.id)}>
        <summary className="cursor-pointer text-sm font-bold text-brand-deep">More</summary>
        <div className="mt-2 flex flex-col gap-3">
          <label className={label}>
            Usually pays by
            <select name="preferredPayment" defaultValue={initial.preferredPayment ?? ''} className={field}>
              <option value="">Not set</option>
              {payments.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {initial.id && (
            <label className={label}>
              Last cleaned (before you started using this)
              <input name="lastCleaned" type="date" defaultValue={initial.lastCleaned ?? ''} className={field} />
              <span className="mt-1 block text-xs font-normal text-ink/70">
                Sets when they are next due. A visit you record later takes over from this date.
              </span>
            </label>
          )}
          <label className={label}>
            Email
            <input name="email" type="email" defaultValue={initial.email} autoComplete="off" className={field} />
          </label>
          <label className={label}>
            Notes
            <textarea name="notes" rows={3} defaultValue={initial.notes} className={field} />
          </label>
        </div>
      </details>

      <button type="submit" className="rounded-xl bg-brand-deep px-4 py-4 text-lg font-black text-white">
        {submitLabel}
      </button>
    </form>
  );
}
