'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRoundOrderAction } from '@/app/admin/settings/actions';

type Stop = { id: string; title: string; subtitle: string };

/** What is being dragged: the floating copy under the finger, and where it was picked up. */
type Drag = {
  id: string;
  /** Pointer position now. */
  x: number;
  y: number;
  /** Where inside the row the finger took hold. */
  grabX: number;
  grabY: number;
  /** The row's size and left edge when picked up. */
  left: number;
  width: number;
  height: number;
  /** After the drop: the floating copy glides to this top, then disappears. */
  settleTop: number | null;
};

const SCALE = 0.94;

/**
 * A round's stops in the order Sam works them. Hold the ☰ handle: the row lifts, shrinks a little and
 * follows the thumb, a dashed gap shows where it will land, and the other rows slide out of the way. Let go
 * and it glides into the gap. The arrows do the same a step at a time and work from the keyboard. Every
 * change is saved at once; the server action re-checks the session and keeps only members of the round.
 */
export function RoundOrderList({ roundId, stops }: { roundId: string; stops: Stop[] }) {
  const router = useRouter();
  const [items, setItems] = useState(stops);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());
  const live = useRef(items);
  live.current = items;

  // A fresh order from the server (after a save or a planner run) replaces what is shown.
  useEffect(() => setItems(stops), [stops]);

  // Rows slide to their new places instead of jumping: remember where each was, and after the order changes
  // start each from its old place and let it ease to the new one.
  useLayoutEffect(() => {
    for (const s of items) {
      const el = rows.current.get(s.id);
      if (!el) continue;
      const now = el.getBoundingClientRect().top;
      const before = tops.current.get(s.id);
      if (before !== undefined && Math.abs(before - now) > 1 && s.id !== drag?.id) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${before - now}px)`;
        void el.offsetHeight;
        el.style.transition = 'transform 160ms ease';
        el.style.transform = '';
      }
      tops.current.set(s.id, now);
    }
  });

  async function save(next: Stop[]) {
    setStatus('Saving…');
    try {
      const r = await saveRoundOrderAction(roundId, next.map((s) => s.id));
      setStatus(r.ok ? 'Saved.' : (r.error ?? 'Could not save the order.'));
      if (r.ok) router.refresh();
    } catch {
      setStatus('Something went wrong. The order was not saved.');
    }
  }

  function moveBy(id: string, step: -1 | 1) {
    const from = items.findIndex((s) => s.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = items.slice();
    [next[from], next[to]] = [next[to], next[from]];
    setItems(next);
    void save(next);
  }

  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    const row = rows.current.get(id);
    if (!row) return;
    const box = row.getBoundingClientRect();
    const before = live.current.map((s) => s.id).join(',');
    const base = { id, left: box.left, width: box.width, height: box.height, grabX: e.clientX - box.left, grabY: e.clientY - box.top };
    setDrag({ ...base, x: e.clientX, y: e.clientY, settleTop: null });
    setStatus(null);
    navigator.vibrate?.(10);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const move = (ev: PointerEvent) => {
      // Near the top or bottom of the screen, scroll so a long round can be dragged all the way.
      if (ev.clientY < 90) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 12);
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      const current = live.current;
      const others = current.filter((s) => s.id !== id);
      // The gap is before the first other row whose middle is below the middle of the floating row.
      const middle = ev.clientY - base.grabY + base.height / 2;
      let slot = others.length;
      for (let i = 0; i < others.length; i++) {
        const b = rows.current.get(others[i].id)?.getBoundingClientRect();
        if (b && middle < b.top + b.height / 2) {
          slot = i;
          break;
        }
      }
      const me = current.find((s) => s.id === id)!;
      const next = [...others.slice(0, slot), me, ...others.slice(slot)];
      if (next.map((s) => s.id).join(',') !== current.map((s) => s.id).join(',')) {
        setItems(next);
        navigator.vibrate?.(5);
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.style.userSelect = prevSelect;
      // Glide the floating row into the gap it left, then drop it.
      const slotTop = rows.current.get(id)?.getBoundingClientRect().top ?? null;
      setDrag((d) => (d ? { ...d, settleTop: slotTop } : d));
      navigator.vibrate?.(10);
      window.setTimeout(() => setDrag(null), 170);
      if (live.current.map((s) => s.id).join(',') !== before) void save(live.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  const dragged = drag ? items.find((s) => s.id === drag.id) : undefined;
  const draggedIndex = drag ? items.findIndex((s) => s.id === drag.id) : -1;

  return (
    <div>
      <ol className="flex flex-col gap-2">
        {items.map((c, i) => {
          const isDragged = drag?.id === c.id;
          return (
            <li
              key={c.id}
              ref={(el) => {
                if (el) rows.current.set(c.id, el);
                else rows.current.delete(c.id);
              }}
              className={`flex items-center gap-2 rounded-xl p-2 ring-1 ${isDragged ? 'bg-brand/5 ring-2 ring-dashed ring-brand-deep/50' : 'bg-white shadow-sm ring-ink/10'}`}
            >
              <div className={`flex min-w-0 flex-1 items-center gap-2 ${isDragged ? 'invisible' : ''}`}>
                <button
                  type="button"
                  aria-label={`Drag ${c.title} to a new place`}
                  onPointerDown={(e) => startDrag(e, c.id)}
                  className="flex h-12 w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-xl text-ink/60 active:cursor-grabbing active:bg-brand/10"
                >
                  ☰
                </button>
                <span className="w-6 shrink-0 text-center font-black text-ink/60">{i + 1}</span>
                <a href={`/admin/customers/${c.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.title}</span>
                  <span className="block truncate text-sm text-ink/70">{c.subtitle}</span>
                </a>
                {(['up', 'down'] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => moveBy(c.id, step === 'up' ? -1 : 1)}
                    disabled={step === 'up' ? i === 0 : i === items.length - 1}
                    aria-label={`Move ${c.title} ${step}`}
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black text-brand-deep ring-1 ring-brand-deep/40 disabled:opacity-30"
                  >
                    {step === 'up' ? '↑' : '↓'}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The copy under the finger: lifted, a little smaller, following the thumb, then gliding home on release. */}
      {drag && dragged && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-xl bg-white p-2 shadow-2xl ring-2 ring-brand-deep"
          style={{
            left: drag.left,
            width: drag.width,
            height: drag.height,
            top: drag.settleTop ?? drag.y - drag.grabY,
            transform: drag.settleTop === null ? `scale(${SCALE}) rotate(-0.6deg)` : 'scale(1)',
            transformOrigin: `${drag.grabX}px ${drag.grabY}px`,
            transition: drag.settleTop === null ? 'transform 120ms ease, box-shadow 120ms ease' : 'top 160ms ease, transform 160ms ease',
          }}
        >
          <span className="flex h-12 w-10 shrink-0 items-center justify-center text-xl text-brand-deep">☰</span>
          <span className="w-6 shrink-0 text-center font-black text-brand-deep">{draggedIndex + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{dragged.title}</span>
            <span className="block truncate text-sm text-ink/70">{dragged.subtitle}</span>
          </span>
        </div>
      )}

      <p role="status" className="mt-2 min-h-5 text-sm text-ink/70">
        {status ?? 'Hold ☰ and drag to reorder, or use the arrows. Changes save as you go.'}
      </p>
    </div>
  );
}
