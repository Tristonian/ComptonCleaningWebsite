'use client';

import dynamic from 'next/dynamic';
import { useActionState, useRef, useState, type FormEvent } from 'react';
import { ContactSent, type SentSnapshot } from '@/components/ContactSent';
import { Ed } from '@/components/Ed';
import { useEditMode } from '@/components/EditMode';
import { labelOf, type Option } from '@/lib/enquiry-options';
import { OptionsEditor } from '@/components/OptionsEditor';
import { sendEnquiry, type ContactState } from '@/app/contact-actions';
import { formatPhone, normaliseEmail, normalisePhone, normalisePostcode } from '@/lib/enquiry';
import { isPlausibleUkPoint, type LatLng } from '@/lib/geo';

// Loaded only when a pin is first shown: the map library is large.
const PinMap = dynamic(() => import('@/components/PinMap').then((m) => m.PinMap), { ssr: false });

const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';
const fieldBad = 'border-red-600 ring-1 ring-red-600';
const errorText = 'text-sm font-semibold text-red-700';

type Locating = 'idle' | 'working' | 'denied' | 'failed';

/**
 * Contact form with a location helper: "Use my location" (browser geolocation, then a free
 * postcode lookup) and a Mapbox pin the customer must tap or drag to confirm. If the map cannot
 * be shown (no token, blocked, no WebGL) or there is no pin yet, nothing is forced and typing
 * still works. Phone, email and postcode are checked as they type; the server checks them again.
 */
export function ContactForm({
  mapboxToken,
  serviceOptions,
  sourceOptions,
  extraServices = [],
}: {
  mapboxToken?: string;
  /** The editable drop-down lists (defaults until Sam edits them), as saved. */
  serviceOptions: Option[];
  sourceOptions: Option[];
  /** Services Sam added (value `svc-<id>`), offered just before "Something else". */
  extraServices?: Option[];
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendEnquiry, { status: 'idle' });
  const { locale } = useEditMode();
  const [service, setService] = useState('');
  // Services Sam added slot in before a trailing "Something else", else go on the end.
  const last = serviceOptions.at(-1);
  const services =
    last?.value === 'other'
      ? [...serviceOptions.slice(0, -1), ...extraServices, last]
      : [...serviceOptions, ...extraServices];
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ phone: false, email: false, postcode: false });
  const [attempted, setAttempted] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  // Only a pin the visitor moved, or a location their device reported, is sent as coordinates. A
  // pin that just sits at the middle of the typed postcode is a guess, so Sam is not told it is confirmed.
  const [confirmed, setConfirmed] = useState(false);
  const [mapBroken, setMapBroken] = useState(false);
  const [postcodeUnknown, setPostcodeUnknown] = useState(false);
  const [locating, setLocating] = useState<Locating>('idle');
  // What "Use my location" or a moved pin filled in, waiting for the visitor to say "yes, that's right".
  const [detected, setDetected] = useState<{ street: string; postcode: string } | null>(null);
  // A copy of what they submitted, so the thank-you can show it back instead of hiding it.
  const [snapshot, setSnapshot] = useState<SentSnapshot | null>(null);
  const lookedUp = useRef('');
  const mapBox = useRef<HTMLDivElement>(null);
  const addressInput = useRef<HTMLInputElement>(null);

  if (state.status === 'sent') {
    return <ContactSent snapshot={snapshot} mapboxToken={mapboxToken} />;
  }

  const mapShown = Boolean(point && mapboxToken && !mapBroken);
  const needsPin = mapShown && !confirmed;

  const phoneBad = phone.trim() !== '' && !normalisePhone(phone);
  const emailBad = email.trim() !== '' && !normaliseEmail(email);
  const postcodeBad = postcode.trim() !== '' && !normalisePostcode(postcode);
  const noContact = phone.trim() === '' && email.trim() === '';
  const showPhoneBad = phoneBad && (touched.phone || attempted);
  const showEmailBad = emailBad && (touched.email || attempted);
  const showPostcodeBad = (postcodeBad && (touched.postcode || attempted)) || postcodeUnknown;
  const showNoContact = noContact && attempted;

  /** Turn a typed postcode into a point for the map (postcodes.io: free, no key). */
  async function lookUpPostcode(raw: string) {
    const clean = normalisePostcode(raw).replace(/\s+/g, '');
    if (!clean || lookedUp.current === clean) return;
    lookedUp.current = clean;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
      if (res.status === 404) return setPostcodeUnknown(true);
      if (!res.ok) return;
      const { result } = (await res.json()) as { result?: { latitude: number; longitude: number } };
      setPostcodeUnknown(false);
      if (result && isPlausibleUkPoint(result.latitude, result.longitude)) {
        setPoint({ lat: result.latitude, lng: result.longitude });
        setConfirmed(false);
      }
    } catch {
      // Offline or blocked: the typed postcode is still submitted and the server decides.
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) return setLocating('failed');
    setLocating('working');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isPlausibleUkPoint(here.lat, here.lng)) return setLocating('failed');
        // Place the pin only: the visitor still has to tap or drag it to confirm. A phone's location is
        // close, not exact, and "confirmed" must mean they looked at the map.
        setPoint(here);
        setConfirmed(false);
        setLocating('idle');
        await fillFromPoint(here);
      },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  /**
   * Fill the postcode (and an empty address) from a point: postcodes.io, then Mapbox. Whatever was
   * filled is then put to the visitor to confirm ("We found ... is that right?"), because a
   * location is only close, not exact.
   */
  async function fillFromPoint(p: LatLng) {
    let foundPostcode = '';
    let foundStreet = '';
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes?lon=${p.lng}&lat=${p.lat}&limit=1&radius=300`);
      if (res.ok) {
        const { result } = (await res.json()) as { result?: { postcode: string }[] | null };
        const found = result?.[0]?.postcode;
        if (found) {
          foundPostcode = found;
          lookedUp.current = found.replace(/\s+/g, '');
          setPostcode(found);
          setPostcodeUnknown(false);
        }
      }
    } catch {
      // Ignore: the visitor can type it.
    }
    if (mapboxToken && !address.trim()) {
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.lng}&latitude=${p.lat}&types=address&limit=1&access_token=${encodeURIComponent(mapboxToken)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as { features?: { properties?: { name?: string } }[] };
          const street = json.features?.[0]?.properties?.name;
          if (street) {
            foundStreet = street;
            setAddress(street);
          }
        }
      } catch {
        // Ignore.
      }
    }
    if (foundPostcode || foundStreet) {
      setDetected({ street: foundStreet || address.trim(), postcode: foundPostcode || postcode.trim() });
    }
  }

  /** Stop the send, and say why, if anything is wrong or the pin is unconfirmed. */
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    setAttempted(true);
    const invalid = phoneBad || emailBad || postcodeBad || postcodeUnknown || noContact || !service;
    if (invalid) return e.preventDefault();
    if (detected) {
      // They have not said whether the address we found is right yet.
      e.preventDefault();
      return;
    }
    if (needsPin) {
      e.preventDefault();
      mapBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    // It is going through: keep a copy to show back to them afterwards.
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const lat = Number(text('lat'));
    const lng = Number(text('lng'));
    setSnapshot({
      name: text('name'),
      service: labelOf(services, text('service'), locale),
      source: labelOf(sourceOptions, text('source'), locale),
      address: text('address'),
      postcode: normalisePostcode(text('postcode')) || text('postcode'),
      phone: normalisePhone(text('phone')) ? formatPhone(normalisePhone(text('phone'))) : '',
      email: normaliseEmail(text('email')),
      notes: text('notes'),
      pin: text('lat') && text('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    });
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.name">Name</Ed>
        <input name="name" required maxLength={100} autoComplete="name" className={field} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.service">What service are you interested in?</Ed>
        <select
          name="service"
          required
          value={service}
          onChange={(e) => setService(e.target.value)}
          aria-invalid={attempted && !service ? true : undefined}
          className={`${field} ${attempted && !service ? fieldBad : ''}`}
        >
          <option value="">{locale === 'cy' ? 'Dewiswch wasanaeth' : 'Choose a service'}</option>
          {services.map((o) => (
            <option key={o.value} value={o.value}>
              {o[locale]}
            </option>
          ))}
        </select>
      </label>
      <OptionsEditor
        list="service"
        title="Edit the service choices"
        options={serviceOptions}
        note="Services you add in the Services section appear in this list automatically, so you don't need to add them here."
      />
      {attempted && !service && (
        <Ed id="contact.form.service.error" as="p" className={errorText}>
          Please choose the service you are interested in.
        </Ed>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.source">Where did you hear about us? (optional)</Ed>
        <select name="source" defaultValue="" className={field}>
          <option value="">{locale === 'cy' ? 'Dewiswch un' : 'Choose one'}</option>
          {sourceOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o[locale]}
            </option>
          ))}
        </select>
      </label>
      <OptionsEditor list="source" title="Edit the &lsquo;Where did you hear about us&rsquo; choices" options={sourceOptions} />

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
          ref={addressInput}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setDetected(null); // they are editing it themselves: that counts as checking
          }}
        />
      </label>
      {detected && (
        <div role="status" className={`flex flex-col gap-2 rounded-lg p-3 text-sm ring-1 ${attempted ? 'bg-red-50 ring-red-600' : 'bg-brand/10 ring-brand/40'}`}>
          <Ed id="contact.check.title" as="p" className="font-semibold text-brand-deep">
            We found this address. Is it right?
          </Ed>
          <p className="text-base font-bold text-ink">
            {detected.street ? `${detected.street}, ` : ''}
            {detected.postcode}
          </p>
          {!detected.street && (
            <Ed id="contact.check.nostreet" as="p" className="text-ink/80">
              We only found the postcode. Please type your house number and street above.
            </Ed>
          )}
          {attempted && (
            <Ed id="contact.check.pending" as="p" className="font-semibold text-red-700">
              Please say if this is right, then send.
            </Ed>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (detected.street ? setDetected(null) : addressInput.current?.focus())}
              className="flex-1 rounded-lg bg-brand-deep px-3 py-2 font-bold text-white"
            >
              <Ed id="contact.check.yes">Yes, that’s right</Ed>
            </button>
            <button
              type="button"
              onClick={() => {
                setDetected(null);
                addressInput.current?.focus();
                addressInput.current?.select();
              }}
              className="flex-1 rounded-lg px-3 py-2 font-bold text-brand-deep ring-2 ring-brand-deep"
            >
              <Ed id="contact.check.no">No, I’ll fix it</Ed>
            </button>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.postcode">Postcode</Ed>
        <input
          name="postcode"
          required
          maxLength={10}
          autoComplete="postal-code"
          autoCapitalize="characters"
          aria-invalid={showPostcodeBad || undefined}
          className={`${field} ${showPostcodeBad ? fieldBad : ''}`}
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value);
            setPostcodeUnknown(false);
            setDetected(null);
            void lookUpPostcode(e.target.value);
          }}
          onBlur={(e) => {
            setTouched((t) => ({ ...t, postcode: true }));
            void lookUpPostcode(e.target.value);
          }}
        />
      </label>
      {showPostcodeBad && (
        <Ed id="contact.form.postcode.error" as="p" className={errorText}>
          Please enter a real, full UK postcode, like BS16 1AA.
        </Ed>
      )}

      {mapShown && point && mapboxToken && (
        <div ref={mapBox} className="flex flex-col gap-2">
          <PinMap
            token={mapboxToken}
            point={point}
            onMove={(p) => {
              setPoint(p);
              setConfirmed(true);
              void fillFromPoint(p);
            }}
            onFail={() => setMapBroken(true)}
          />
          {confirmed ? (
            <Ed id="contact.loc.confirmed" as="p" className="rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-deep">
              ✓ Location confirmed. Thank you.
            </Ed>
          ) : (
            <Ed
              id="contact.loc.confirm"
              as="p"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${attempted ? 'bg-red-50 text-red-700 ring-1 ring-red-600' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-400'}`}
            >
              Please tap the map or drag the pin onto your home to confirm where we’re going, then send.
            </Ed>
          )}
        </div>
      )}
      <input type="hidden" name="lat" value={point && confirmed ? String(point.lat) : ''} />
      <input type="hidden" name="lng" value={point && confirmed ? String(point.lng) : ''} />

      <div className="flex flex-col gap-1">
        <Ed id="contact.form.either" as="p" className="text-sm text-ink/80">
          How can we reach you? A phone number or an email: at least one.
        </Ed>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <Ed id="contact.form.phone">Phone</Ed>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={30}
            autoComplete="tel"
            placeholder="07xxx xxxxxx"
            aria-invalid={showPhoneBad || undefined}
            className={`${field} ${showPhoneBad || showNoContact ? fieldBad : ''}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          />
        </label>
        {showPhoneBad && (
          <Ed id="contact.form.phone.error" as="p" className={errorText}>
            That doesn’t look like a UK phone number. Try a number like 07xxx xxxxxx.
          </Ed>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <Ed id="contact.form.email">Email</Ed>
          <input
            name="email"
            type="email"
            inputMode="email"
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            aria-invalid={showEmailBad || undefined}
            className={`${field} ${showEmailBad || showNoContact ? fieldBad : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          />
        </label>
        {showEmailBad && (
          <Ed id="contact.form.email.error" as="p" className={errorText}>
            That email address doesn’t look right. Please check it.
          </Ed>
        )}
      </div>
      {showNoContact && (
        <Ed id="contact.form.contact.error" as="p" className={errorText}>
          Please give us a phone number or an email so we can reply.
        </Ed>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.notes">Notes (optional)</Ed>
        <textarea name="notes" rows={4} maxLength={1000} className={field} />
      </label>
      {/* Honeypot, hidden from people and assistive tech. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {state.status === 'error' && state.error === 'rate' && (
        <Ed id="contact.form.rate" as="p" className={errorText}>
          Too many messages just now. Please give us a call or text instead.
        </Ed>
      )}
      {state.status === 'error' && state.error === 'postcode-unknown' && (
        <Ed id="contact.form.postcode.unknown" as="p" className={errorText}>
          We couldn’t find that postcode. Please check it, or give us a call.
        </Ed>
      )}
      {state.status === 'error' && state.error === 'email-domain' && (
        <Ed id="contact.form.email.domain" as="p" className={errorText}>
          We couldn’t find that email’s domain. Please check the spelling, or use your phone number.
        </Ed>
      )}
      {state.status === 'error' &&
        !['rate', 'postcode-unknown', 'email-domain'].includes(state.error) && (
          <Ed id="contact.form.error" as="p" className={errorText}>
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
