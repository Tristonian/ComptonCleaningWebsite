'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from '@/components/EditMode';
import { setSectionHiddenAction } from '@/app/service-actions';

/**
 * Wraps a section Sam can hide. Visitors see nothing while it is hidden. In pencil mode a hidden
 * section collapses to a one-line stub with a Show button, and a visible one gets a Hide button, so
 * nothing is ever lost: hiding only stops it displaying. The server action re-checks the session.
 */
export function Hideable({
  id,
  label,
  hidden,
  children,
}: {
  id: string;
  label: string;
  hidden: boolean;
  children: React.ReactNode;
}) {
  const { editing } = useEditMode();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden && !editing) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const r = await setSectionHiddenAction(id, !hidden);
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (hidden) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-ink/30 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-ink/70">
            Hidden: <strong>{label}</strong> (visitors can&rsquo;t see it)
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className="rounded-lg bg-brand-deep px-3 py-2 font-bold text-white disabled:opacity-50"
          >
            Show
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative">
      {editing && (
        <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-ink shadow ring-1 ring-ink/20 disabled:opacity-50"
          >
            🙈 Hide
          </button>
          {error && <span role="alert" className="rounded bg-white px-2 text-xs font-semibold text-red-700">{error}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
