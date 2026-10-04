'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LOGO_ASPECT, LogoError, decodeLogo, renderLogo } from '@/lib/logo-crop';

/**
 * Position a picture inside the logo frame: drag to move, pinch or slide to zoom. The frame is
 * painted in the real hero colour so Sam sees what visitors will see (the logo is usually white).
 * Zooming out below "fill" leaves transparent padding, which is wanted for a logo.
 *
 * One piece of maths: `scale` is the image width as a fraction of the frame width, and `dx`/`dy`
 * are the image centre as fractions of the frame. The preview and `renderLogo` both use exactly
 * those numbers, so what you see is what is saved.
 */

const FRAME_W = 300;
const FRAME_H = FRAME_W / LOGO_ASPECT;

export function LogoCropper({
  file,
  background,
  onCancel,
  onDone,
}: {
  file: File;
  background: string;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState({ scale: 1, dx: 0, dy: 0 });
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; dx: number; dy: number; mx: number; my: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    let cancelled = false;
    let decoded: ImageBitmap | null = null;
    decodeLogo(file)
      .then((b) => {
        if (cancelled) return b.close();
        decoded = b;
        setBitmap(b);
        // Start with the whole picture visible inside the frame.
        const fit = Math.min(1, LOGO_ASPECT / (b.width / b.height));
        setPlace({ scale: fit, dx: 0, dy: 0 });
      })
      .catch((e) => !cancelled && setError(e instanceof LogoError ? e.message : 'That image could not be read.'));
    return () => {
      cancelled = true;
      decoded?.close();
    };
  }, [file]);

  const imgAspect = bitmap ? bitmap.width / bitmap.height : 1;
  const fitScale = Math.min(1, LOGO_ASPECT / imgAspect);
  const minScale = fitScale * 0.3;
  const maxScale = Math.max(fitScale, 1) * 4;

  const clampScale = (s: number) => Math.min(maxScale, Math.max(minScale, s));
  /** Keep the image centre inside the frame so it can never be lost off-screen. */
  const clampPos = (v: number) => Math.min(0.5, Math.max(-0.5, v));

  function snapshot() {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) return (gesture.current = null);
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { dist, scale: place.scale, dx: place.dx, dy: place.dy, mx, my };
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const scale =
      pts.length > 1 && g.dist > 0
        ? clampScale(g.scale * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist))
        : g.scale;
    setPlace({
      scale,
      dx: clampPos(g.dx + (mx - g.mx) / FRAME_W),
      dy: clampPos(g.dy + (my - g.my) / FRAME_H),
    });
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    snapshot();
  }

  function confirm() {
    if (!bitmap) return;
    setBusy(true);
    setError(null);
    renderLogo(bitmap, place, file.name)
      .then(onDone)
      .catch((e) => setError(e instanceof LogoError ? e.message : 'That image could not be prepared.'))
      .finally(() => setBusy(false));
  }

  const imgW = place.scale * FRAME_W;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Position the logo">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <h3 className="text-lg font-black text-brand-deep">Position the logo</h3>
        <p className="mt-0.5 text-xs text-ink/70">
          Drag to move it, pinch or use the slider to zoom. The coloured box is what is saved.
        </p>
        <div
          className="relative mx-auto mt-3 touch-none select-none overflow-hidden rounded-lg ring-1 ring-ink/20"
          style={{ width: FRAME_W, height: FRAME_H, background }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            snapshot();
          }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {bitmap && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: imgW,
                left: FRAME_W / 2 + place.dx * FRAME_W - imgW / 2,
                top: FRAME_H / 2 + place.dy * FRAME_H - imgW / imgAspect / 2,
              }}
            />
          )}
        </div>
        <label className="mt-3 block text-xs text-ink/70">
          Zoom
          <input
            type="range"
            min={minScale}
            max={maxScale}
            step={0.005}
            value={place.scale}
            disabled={!bitmap}
            onChange={(e) => setPlace((p) => ({ ...p, scale: Number(e.target.value) }))}
            className="mt-1 w-full accent-brand-deep"
          />
        </label>
        {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-ink ring-1 ring-ink/20">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!bitmap || busy}
            className="flex-1 rounded-xl bg-brand-deep px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Use this'}
          </button>
        </div>
      </div>
    </div>
  );
}
