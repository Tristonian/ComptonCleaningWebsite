'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from '@/components/EditMode';
import { BlockZone } from '@/components/BlockZone';
import { Hideable } from '@/components/Hideable';
import type { Block, ZoneId } from '@/lib/blocks-shared';
import type { CustomService } from '@/lib/services-custom';
import {
  addServiceAction,
  deleteServiceAction,
  moveServiceAction,
  updateServiceAction,
} from '@/app/service-actions';

const small = 'rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-brand-deep shadow ring-1 ring-ink/20 disabled:opacity-40';

/** English/Welsh text with Welsh falling back to English while it is empty. */
const pick = (en: string, cy: string, locale: 'en' | 'cy') => (locale === 'cy' && cy ? cy : en);

/** A service Sam added: title, description, two photo/GIF zones (under the title, under the text), and (pencil) move/edit/delete/hide. */
export function CustomServiceCard({
  service,
  topBlocks,
  blocks,
  order,
  hidden,
}: {
  service: CustomService;
  /** Blocks between the title and the text (e.g. an animated GIF). */
  topBlocks: Block[];
  blocks: Block[];
  order: string[];
  hidden: boolean;
}) {
  const { editing, locale } = useEditMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zone = `svc-${service.id}` as ZoneId;
  const shownTitle = pick(service.titleEn, service.titleCy, locale);
  const shownBody = pick(service.bodyEn, service.bodyCy, locale);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Something went wrong.');
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Hideable id={zone} label={shownTitle} hidden={hidden}>
      <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
        <h3 className="mb-2 text-xl font-bold">{shownTitle}</h3>
        <BlockZone zone={`${zone}-top` as ZoneId} compact blocks={topBlocks} order={order} label={`${service.titleEn}: under the title`} />
        {shownBody && <p className="whitespace-pre-line text-ink/80">{shownBody}</p>}

        <BlockZone zone={zone} compact blocks={blocks} order={order} label={`${service.titleEn}: under the text`} />

        {editing && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={small} onClick={() => run(() => moveServiceAction(service.id, -1))}>
              ▲ Earlier
            </button>
            <button type="button" disabled={busy} className={small} onClick={() => run(() => moveServiceAction(service.id, 1))}>
              ▼ Later
            </button>
            <button
              type="button"
              disabled={busy}
              className={small}
              onClick={() => {
                setTitle(shownTitle);
                setBody(shownBody);
                setOpen(true);
              }}
            >
              ✎ Edit words
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${small} !text-red-700`}
              onClick={() => {
                if (confirm(`Delete "${shownTitle}" and all its photos for good? (Hide it instead to keep it.)`)) {
                  void run(() => deleteServiceAction(service.id));
                }
              }}
            >
              🗑 Delete
            </button>
          </div>
        )}
        {editing && open && (
          <div className="mt-3 rounded-xl bg-paper p-3 ring-1 ring-ink/20">
            <label className="block text-xs font-semibold text-ink/70">
              Title ({locale === 'cy' ? 'Cymraeg' : 'English'})
              <input
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/20 p-2 text-base font-normal text-ink"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-ink/70">
              Description
              <textarea
                value={body}
                rows={4}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/20 p-2 text-base font-normal text-ink"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => run(() => updateServiceAction(service.id, locale, title, body))}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ring-ink/20" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>
    </Hideable>
  );
}

export function AddServiceButton() {
  const { editing } = useEditMode();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!editing) return null;
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className="w-full rounded-2xl border-2 border-dashed border-brand-deep/50 px-4 py-5 text-base font-bold text-brand-deep disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await addServiceAction().catch(() => null);
          setBusy(false);
          if (r?.ok) router.refresh();
          else setError(r?.ok === false ? r.error : 'Something went wrong. Try again.');
        }}
      >
        ➕ Add a service (e.g. Pressure washing)
      </button>
      {error && <p role="alert" className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
