'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addVisitPhotoAction, deleteVisitPhotoAction } from '@/app/admin/visit-actions';
import { PhotoError, shrinkPhoto } from '@/lib/photo-resize';

type Photo = { id: string; hash: string };

/**
 * Photos on one visit: thumbnails (tap to open full size), a remove button with a second tap to confirm,
 * and an add button that opens the phone camera or gallery. Each photo is shrunk in the browser first
 * (ADR 0002), which also strips the GPS position phones embed.
 */
export function VisitPhotos({ jobId, photos, max }: { jobId: string; photos: Photo[]; max: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function upload(picked: File[]) {
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return setError('Those are not images. Use PNG, JPG or WebP photos.');
    setError(null);
    let problem: string | null = null;
    for (let i = 0; i < images.length; i++) {
      setBusy(`Uploading photo ${i + 1} of ${images.length}…`);
      try {
        const small = await shrinkPhoto(images[i]);
        const body = new FormData();
        body.set('file', small.file);
        body.set('jobId', jobId);
        body.set('width', String(small.width));
        body.set('height', String(small.height));
        const r = await addVisitPhotoAction(body);
        if (!r.ok) {
          problem = r.error ?? 'A photo could not be saved.';
          break;
        }
      } catch (e) {
        problem = e instanceof PhotoError ? e.message : 'A photo could not be uploaded.';
      }
    }
    setBusy(null);
    if (problem) setError(problem);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy('Removing…');
    setError(null);
    try {
      const r = await deleteVisitPhotoAction(id);
      if (!r.ok) setError(r.error ?? 'Could not remove that photo.');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(null);
      setConfirm(null);
      router.refresh();
    }
  }

  return (
    <div className="mt-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id} className="flex w-24 flex-col gap-1">
              <a href={`/img/${p.hash}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/img/${p.hash}`} alt="Photo of this clean" loading="lazy" className="h-24 w-24 rounded-lg object-cover ring-1 ring-ink/10" />
              </a>
              {confirm === p.id ? (
                <button type="button" disabled={!!busy} onClick={() => remove(p.id)} className="rounded-lg bg-red-700 px-2 py-2 text-xs font-bold text-white">
                  Really remove?
                </button>
              ) : (
                <button type="button" disabled={!!busy} onClick={() => setConfirm(p.id)} className="rounded-lg px-2 py-2 text-xs font-bold text-red-800 ring-1 ring-red-300">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {photos.length < max && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              e.target.value = '';
              if (picked.length) void upload(picked);
            }}
          />
          <button
            type="button"
            disabled={!!busy}
            onClick={() => input.current?.click()}
            className="mt-2 rounded-xl px-4 py-3 text-sm font-bold text-brand-deep ring-2 ring-brand-deep/40 disabled:opacity-60"
          >
            📷 Add photos
          </button>
        </>
      )}
      {busy && <p role="status" className="mt-1 text-sm text-ink/70">{busy}</p>}
      {error && <p role="alert" className="mt-1 text-sm font-semibold text-red-800">{error}</p>}
    </div>
  );
}
