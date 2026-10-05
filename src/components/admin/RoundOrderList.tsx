'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRoundOrderAction } from '@/app/admin/settings/actions';

type Stop = { id: string; title: string; subtitle: string };

/**
 * A round's stops in the order Sam works them. Hold the ☰ handle and drag a stop up or down (touch or
 * mouse); the arrows do the same a step at a time and work from the keyboard. Every change is saved at
 * once. The handle has `touch-action: none` so dragging it does not scroll the page; the rest of the row
 * still scrolls normally. The server action re-checks the session and keeps only members of the round.
 */
export function RoundOrderList({ roundId, stops }: { roundId: string; stops: Stop[] }) {
  const router = useRouter();
  const [items, setItems] = useState(stops);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const live = useRef(items);
  live.current = items;

  // A fresh order from the server (after a save or a planner run) replaces what is shown.
  useEffect(() => setItems(stops), [stops]);

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
    const before = live.current.map((s) => s.id).join(',');
    setDragging(id);
    setStatus(null);

    const move = (ev: PointerEvent) => {
      // Near the top or bottom of the screen, scroll so a long round can be dragged all the way.
      if (ev.clientY < 90) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 12);
      const current = live.current;
      const others = current.filter((s) => s.id !== id);
      // The slot is the first other row whose middle is below the finger.
      let slot = others.length;
      for (let i = 0; i < others.length; i++) {
        const box = rows.current.get(others[i].id)?.getBoundingClientRect();
        if (box && ev.clientY < box.top + box.height / 2) {
          slot = i;
          break;
        }
      }
      const me = current.find((s) => s.id === id)!;
      const next = [...others.slice(0, slot), me, ...others.slice(slot)];
      if (next.map((s) => s.id).join(',') !== current.map((s) => s.id).join(',')) setItems(next);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(null);
      if (live.current.map((s) => s.id).join(',') !== before) void save(live.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  return (
    <div>
      <ol className="flex flex-col gap-2">
        {items.map((c, i) => (
          <li
            key={c.id}
            ref={(el) => {
              if (el) rows.current.set(c.id, el);
              else rows.current.delete(c.id);
            }}
            className={`flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ${dragging === c.id ? 'z-10 scale-[1.02] shadow-lg ring-2 ring-brand-deep' : 'ring-ink/10'}`}
          >
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
          </li>
        ))}
      </ol>
      <p role="status" className="mt-2 min-h-5 text-sm text-ink/70">
        {status ?? 'Hold ☰ and drag to reorder, or use the arrows. Changes save as you go.'}
      </p>
    </div>
  );
}
