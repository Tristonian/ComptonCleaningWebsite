'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditMode } from '@/components/EditMode';
import { AppearanceManager } from '@/components/admin/AppearanceManager';
import { loadAppearanceAction } from '@/app/admin/appearance/actions';

type Data = NonNullable<Awaited<ReturnType<typeof loadAppearanceAction>>>;

/**
 * Pencil-mode entry to the logo and colour tools, shown in the hero only while editing. Opens the
 * same manager as /admin/appearance in a sheet over the page; data is fetched on open (admin-only
 * action), so visitors never load it. Portalled to <body> so the fixed hero cannot clip or
 * stack it under the pencil button.
 */
export function AppearanceEditor() {
  const { editing } = useEditMode();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(null);
    loadAppearanceAction()
      .then((d) => !cancelled && (d ? setData(d) : setFailed("You are not signed in as an admin. Sign in again and retry.")))
      .catch(() => !cancelled && setFailed("The server had a problem loading this. Close it and try again in a moment."));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Leaving edit mode closes the sheet.
  useEffect(() => {
    if (!editing) setOpen(false);
  }, [editing]);

  if (!editing) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hero-fade absolute bottom-2 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-deep shadow-lg ring-2 ring-brand-deep/40"
      >
        🖼️ Logo and colour
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[75] overflow-y-auto bg-ink/60 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Logo and colour">
            <div className="mx-auto max-w-xl rounded-2xl bg-paper p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black text-brand-deep">Logo and colour</h2>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-ink/20">
                  Done
                </button>
              </div>
              {failed && <p className="text-sm font-semibold text-red-700">{failed}</p>}
              {!data && !failed && <p className="text-sm text-ink/70">Loading…</p>}
              {data && <AppearanceManager key={`${data.activeHash}-${data.heroColour}-${data.logos.length}`} {...data} />}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
