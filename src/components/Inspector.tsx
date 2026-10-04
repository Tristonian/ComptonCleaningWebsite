'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditMode } from '@/components/EditMode';
import { RichTextEditor } from '@/components/RichTextEditor';
import { richToPlain, toEditorHtml } from '@/lib/rich';

/**
 * Bottom sheet, because Sam edits from a phone: a docked side panel would cover the text being
 * edited. Wording only for now (typography and theme are a later phase, ADR 0004).
 */
export function Inspector() {
  const {
    locale,
    selected,
    select,
    registered,
    overrideOf,
    currentOf,
    preview,
    discard,
    isDirty,
    commit,
    revert,
    busy,
  } = useEditMode();
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const key = selected as string;
  const def = registered(key);
  const shown = currentOf(key) ?? def?.text ?? '';
  const dirty = isDirty(key);
  const hasOverride = overrideOf(key) !== undefined;
  const draftWelsh = locale === 'cy' && def?.machine && !hasOverride;

  useEffect(() => {
    setError(null);
    area.current?.focus();
  }, [key]);

  async function onSave() {
    setError(null);
    const r = await commit(key);
    if (!r.ok) setError(r.error ?? 'Could not save.');
    else select(null);
  }

  async function onRevert() {
    setError(null);
    const r = await revert(key);
    if (!r.ok) setError(r.error ?? 'Could not revert.');
    else select(null);
  }

  function onCancel() {
    discard(key);
    select(null);
  }

  return (
    <div
      role="dialog"
      aria-label="Edit text"
      className="fixed inset-x-0 bottom-0 z-[70] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] print:hidden"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate font-mono text-xs text-ink/60">
            {locale === 'cy' ? 'Cymraeg' : 'English'} · {key}
          </p>
          <button type="button" onClick={onCancel} aria-label="Close" className="px-2 text-xl leading-none">
            ×
          </button>
        </div>

        {draftWelsh && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Draft Welsh, not yet checked by a fluent speaker.
          </p>
        )}

        {def?.rich ? (
          // Keyed so selecting another piece of text loads its words into a fresh editor.
          <RichTextEditor key={`${locale}:${key}`} value={toEditorHtml(shown)} onChange={(html) => preview(key, html)} autoFocus />
        ) : (
          <textarea
            ref={area}
            value={shown}
            onChange={(e) => preview(key, e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-ink/20 p-3 text-base focus:border-brand focus:outline-none"
          />
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !dirty}
            className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {hasOverride && (
            <button
              type="button"
              onClick={onRevert}
              disabled={busy}
              className="rounded-xl border border-ink/20 px-4 py-3 text-sm disabled:opacity-40"
            >
              Revert
            </button>
          )}
        </div>
        {hasOverride && def && (
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-ink/60">
            Original: {def.rich ? richToPlain(def.text) : def.text}
          </p>
        )}
      </div>
    </div>
  );
}
