'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogoCropper } from '@/components/admin/LogoCropper';
import {
  deleteLogoAction,
  selectLogoAction,
  setHeroColourAction,
  uploadLogoAction,
} from '@/app/admin/appearance/actions';
import { DEFAULT_LOGO_SRC, logoSrc, normaliseHex, whiteContrast } from '@/lib/appearance-shared';

type Logo = { hash: string; label: string };

/** The shipped gradient's middle stop, shown in the picker when no colour has been chosen. */
const DEFAULT_COLOUR = '#2fadc2';
const PRESETS = ['#0e8abe', '#2fadc2', '#085478', '#1d6f5f', '#3d5a80', '#6b4e9b'];

const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10';
const btn = 'rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-brand-deep/40 text-brand-deep disabled:opacity-50';

export function AppearanceManager({
  logos,
  activeHash,
  heroColour,
}: {
  logos: Logo[];
  activeHash: string | null;
  heroColour: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [colour, setColour] = useState(heroColour ?? DEFAULT_COLOUR);
  const fileInput = useRef<HTMLInputElement>(null);

  const background = heroColour ?? DEFAULT_COLOUR;
  const contrast = whiteContrast(normaliseHex(colour) ?? DEFAULT_COLOUR);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMessage(null);
    start(async () => {
      const r = await action();
      setMessage(r.ok ? { ok: true, text: done } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  function upload(cropped: File) {
    setPicked(null);
    const body = new FormData();
    body.set('file', cropped);
    body.set('label', cropped.name);
    run(() => uploadLogoAction(body), 'Logo saved and now showing on the site.');
  }

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.ok ? 'bg-brand/10 text-brand-deep' : 'bg-red-50 text-red-800'}`}
        >
          {message.text}
        </p>
      )}

      <section className={card}>
        <h2 className="text-xl font-black text-brand-deep">Logo</h2>
        <p className="mt-1 text-sm text-ink/70">Tap a logo to use it on the site. Upload as many as you like and switch between them.</p>

        <ul className="mt-4 grid grid-cols-2 gap-3">
          <LogoTile
            src={DEFAULT_LOGO_SRC}
            name="Original"
            background={background}
            active={activeHash === null}
            disabled={pending}
            onUse={() => run(() => selectLogoAction(null), 'Original logo is back on the site.')}
          />
          {logos.map((l) => (
            <LogoTile
              key={l.hash}
              src={logoSrc(l.hash)}
              name={l.label || 'Uploaded logo'}
              background={background}
              active={activeHash === l.hash}
              disabled={pending}
              onUse={() => run(() => selectLogoAction(l.hash), 'Logo changed.')}
              onDelete={() => {
                if (confirm('Delete this logo for good?')) run(() => deleteLogoAction(l.hash), 'Logo deleted.');
              }}
            />
          ))}
        </ul>

        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPicked(f);
            e.target.value = '';
          }}
        />
        <button type="button" className={`${btn} mt-4 w-full`} disabled={pending} onClick={() => fileInput.current?.click()}>
          Upload a new logo
        </button>
        <p className="mt-2 text-xs text-ink/60">
          PNG, JPG or WebP. A white logo on a transparent background looks best on the coloured header.
        </p>
      </section>

      <section className={card}>
        <h2 className="text-xl font-black text-brand-deep">Header colour</h2>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick a colour"
            value={normaliseHex(colour) ?? DEFAULT_COLOUR}
            onChange={(e) => setColour(e.target.value)}
            className="h-14 w-20 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <input
            type="text"
            aria-label="Colour code"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            maxLength={7}
            className="w-28 rounded-lg px-3 py-3 font-mono text-sm ring-1 ring-ink/20"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Use ${p}`}
              onClick={() => setColour(p)}
              className="h-9 w-9 rounded-full ring-2 ring-white shadow ring-offset-1 ring-offset-ink/20"
              style={{ background: p }}
            />
          ))}
        </div>
        <div className="mt-4 rounded-xl px-4 py-3 text-center text-sm font-bold text-white" style={{ background: normaliseHex(colour) ?? DEFAULT_COLOUR }}>
          How the header text will look
        </div>
        {contrast < 3 && (
          <p className="mt-2 text-xs text-amber-800">
            This colour is quite light, so the white text and logo may be hard to read. Try a darker one.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={pending || !normaliseHex(colour)}
            onClick={() => run(() => setHeroColourAction(colour), 'Header colour saved.')}
            className="flex-1 rounded-xl bg-brand-deep px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Save colour
          </button>
          <button
            type="button"
            disabled={pending || heroColour === null}
            onClick={() => {
              setColour(DEFAULT_COLOUR);
              run(() => setHeroColourAction(null), 'Back to the original colours.');
            }}
            className={btn}
          >
            Reset
          </button>
        </div>
      </section>

      {picked && <LogoCropper file={picked} background={background} onCancel={() => setPicked(null)} onDone={upload} />}
    </div>
  );
}

function LogoTile({
  src,
  name,
  background,
  active,
  disabled,
  onUse,
  onDelete,
}: {
  src: string;
  name: string;
  background: string;
  active: boolean;
  disabled: boolean;
  onUse: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className={`overflow-hidden rounded-xl ${active ? 'ring-4 ring-brand-deep' : 'ring-1 ring-ink/20'}`}>
      <button type="button" disabled={disabled || active} onClick={onUse} className="block w-full" aria-label={`Use ${name}`}>
        <span className="block p-2" style={{ background }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="mx-auto h-16 w-auto" />
        </span>
      </button>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
        <span className="truncate font-semibold">{active ? '✓ In use' : name}</span>
        {onDelete && !active && (
          <button type="button" disabled={disabled} onClick={onDelete} className="font-bold text-red-700">
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
