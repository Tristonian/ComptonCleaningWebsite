'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEditMode } from '@/components/EditMode';
import type { Option } from '@/lib/enquiry-options';
import { resetOptionsAction, saveOptionsAction } from '@/app/option-actions';

type Row = { key: number; value?: string; en: string; cy: string };

/**
 * Pencil-mode editor for one of the contact form's drop-downs: rename, add, remove, reorder (▲ ▼).
 * Edits are a local draft; Save replaces the whole list on the server, Cancel throws the draft away,
 * "Reset to the original list" goes back to the defaults. Welsh is optional (falls back to English).
 * Services added in the Services section appear in the drop-down by themselves, so they are listed
 * here as a note, not as rows.
 */
export function OptionsEditor({
  list,
  title,
  options,
  note,
}: {
  list: 'service' | 'source';
  title: string;
  /** The list as it is now, as saved (never including the automatic extras). */
  options: Option[];
  note?: string;
}) {
  const { editing } = useEditMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setOpen(false);
  }, [editing]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!editing) return null;

  const start = () => {
    setRows(options.map((o, i) => ({ key: i, value: o.value, en: o.en, cy: o.cy === o.en ? '' : o.cy })));
    setError(null);
    setOpen(true);
  };
  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

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

  const btn = 'rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-brand-deep shadow ring-1 ring-ink/20 disabled:opacity-40';

  return (
    <>
      <button type="button" onClick={start} className={`${btn} self-start`}>
        ✎ Edit the choices
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[75] overflow-y-auto bg-ink/60 p-4 print:hidden"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mx-auto max-w-xl rounded-2xl bg-paper p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-brand-deep">{title}</h2>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-ink/20">
                  ✕ Close
                </button>
              </div>
              {note && <p className="mb-3 rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand-deep">{note}</p>}

              <ul className="flex flex-col gap-3">
                {rows.map((r, i) => (
                  <li key={r.key} className="rounded-xl bg-white p-3 ring-1 ring-ink/15">
                    <label className="block text-xs font-semibold text-ink/70">
                      Name (English)
                      <input
                        value={r.en}
                        maxLength={80}
                        onChange={(e) => patch(r.key, { en: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-ink/20 p-2 text-base font-normal text-ink"
                      />
                    </label>
                    <label className="mt-2 block text-xs font-semibold text-ink/70">
                      Cymraeg (optional)
                      <input
                        value={r.cy}
                        maxLength={80}
                        onChange={(e) => patch(r.key, { cy: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-ink/20 p-2 text-base font-normal text-ink"
                      />
                    </label>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" aria-label="Move up" disabled={i === 0} className={btn} onClick={() => move(i, -1)}>
                        ▲
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === rows.length - 1} className={btn} onClick={() => move(i, 1)}>
                        ▼
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        disabled={rows.length <= 1}
                        className={`${btn} !text-red-700`}
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      >
                        🗑 Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="mt-3 w-full rounded-xl border-2 border-dashed border-brand-deep/50 px-4 py-3 text-sm font-bold text-brand-deep"
                onClick={() => setRows((rs) => [...rs, { key: Math.max(-1, ...rs.map((x) => x.key)) + 1, en: '', cy: '' }])}
              >
                ➕ Add a choice
              </button>

              {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-brand-deep px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  onClick={() => run(() => saveOptionsAction(list, rows.map(({ value, en, cy }) => ({ value, en, cy }))))}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-ink/20" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                className="mt-3 w-full text-center text-xs font-bold text-ink/60 underline"
                onClick={() => {
                  if (confirm('Go back to the original list? Your changes to this list will be lost.')) {
                    void run(() => resetOptionsAction(list));
                  }
                }}
              >
                Reset to the original list
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
