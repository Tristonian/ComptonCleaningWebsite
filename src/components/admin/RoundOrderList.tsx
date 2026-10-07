'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRoundOrderAction } from '@/app/admin/settings/actions';

type Stop = { id: string; title: string; subtitle: string };

const SCALE = 0.95;
const SETTLE_MS = 150;

/**
 * A round's stops in the order Sam works them. Hold the ☰ handle: a smaller copy of the row follows the
 * thumb, the row it came from stays put as a faded, dashed gap showing where it will land, and the other
 * rows slide aside. Let go and the copy glides into the gap. The arrows do the same a step at a time and
 * work from the keyboard. Every change is saved at once; the server action re-checks the session.
 *
 * Built to be hard to break on a phone:
 *  - the copy is moved by writing its style directly, not through React state, so a drag is not a stream of
 *    re-renders;
 *  - row positions for the slide-aside animation are measured from the top of the PAGE, so scrolling while
 *    dragging can never look like every row having moved;
 *  - the original row is only faded, never hidden, so nothing can vanish;
 *  - however the drag ends (lift, cancel, the tab losing focus, leaving the page) the copy is removed and
 *    the page's scroll lock is released;
 *  - no vibration: a buzz on every step was far too much on a thumb.
 */
export function RoundOrderList({ roundId, stops }: { roundId: string; stops: Stop[] }) {
  const router = useRouter();
  const [items, setItems] = useState(stops);
  const [dragId, setDragId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const pageTops = useRef(new Map<string, number>());
  const ghost = useRef<HTMLDivElement>(null);
  const live = useRef(items);
  live.current = items;
  const cleanup = useRef<(() => void) | null>(null);

  // A fresh order from the server (after a save or a planner run) replaces what is shown.
  useEffect(() => setItems(stops), [stops]);

  // Never leave a drag half-finished if the list goes away.
  useEffect(() => () => cleanup.current?.(), []);

  // Rows slide to their new places: remember each row's place on the PAGE, and after the order changes
  // start each from its old place and ease to the new one.
  useLayoutEffect(() => {
    const scrollY = window.scrollY;
    for (const s of items) {
      const el = rows.current.get(s.id);
      if (!el) continue;
      const now = el.getBoundingClientRect().top + scrollY;
      const before = pageTops.current.get(s.id);
      if (before !== undefined && Math.abs(before - now) > 1 && s.id !== dragId) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${before - now}px)`;
        void el.offsetHeight;
        el.style.transition = 'transform 150ms ease';
        el.style.transform = '';
      }
      pageTops.current.set(s.id, now);
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
    if (cleanup.current) return; // one drag at a time
    e.preventDefault();
    const row = rows.current.get(id);
    const box = row?.getBoundingClientRect();
    if (!row || !box) return;
    const before = live.current.map((s) => s.id).join(',');
    const grabX = e.clientX - box.left;
    const grabY = e.clientY - box.top;
    const height = box.height;
    let pointerY = e.clientY;
    let done = false;
    setDragId(id);
    setStatus(null);

    const place = (y: number, scale: number) => {
      const g = ghost.current;
      if (!g) return;
      if (!g.style.width) {
        // First time: size it like the row it came from and show it, at full size, right under the thumb.
        g.style.left = `${box.left}px`;
        g.style.width = `${box.width}px`;
        g.style.height = `${height}px`;
        g.style.transformOrigin = `${grabX}px ${grabY}px`;
        g.style.transform = 'scale(1)';
        g.style.opacity = '1';
      }
      g.style.top = `${y - grabY}px`;
      g.style.transform = `scale(${scale})`;
    };
    // Then it eases down to its smaller size.
    requestAnimationFrame(() => {
      place(pointerY, 1);
      requestAnimationFrame(() => place(pointerY, SCALE));
    });

    const reorder = () => {
      const current = live.current;
      const others = current.filter((s) => s.id !== id);
      // The gap goes before the first other row whose middle is below the middle of the copy.
      const middle = pointerY - grabY + height / 2;
      let slot = others.length;
      for (let i = 0; i < others.length; i++) {
        const b = rows.current.get(others[i].id)?.getBoundingClientRect();
        if (b && middle < b.top + b.height / 2) {
          slot = i;
          break;
        }
      }
      const me = current.find((s) => s.id === id);
      if (!me) return;
      const next = [...others.slice(0, slot), me, ...others.slice(slot)];
      if (next.map((s) => s.id).join(',') !== current.map((s) => s.id).join(',')) setItems(next);
    };

    const move = (ev: PointerEvent) => {
      pointerY = ev.clientY;
      place(pointerY, SCALE);
      // Near the top or bottom of the screen, scroll so a long round can be dragged all the way.
      if (ev.clientY < 90) window.scrollBy(0, -10);
      else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 10);
      reorder();
    };
    // The page must not scroll or pull-to-refresh under a drag in progress.
    const stopScroll = (ev: TouchEvent) => ev.preventDefault();

    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      window.removeEventListener('touchmove', stopScroll);
      document.body.style.userSelect = prevSelect;
      document.body.style.overscrollBehavior = prevOverscroll;
      // Glide the copy into the gap, then remove it. Whatever happens, it is gone shortly.
      const target = rows.current.get(id)?.getBoundingClientRect();
      const g = ghost.current;
      if (g && target && commit) {
        g.style.transition = `top ${SETTLE_MS}ms ease, transform ${SETTLE_MS}ms ease`;
        g.style.top = `${target.top}px`;
        g.style.transform = 'scale(1)';
      }
      window.setTimeout(
        () => {
          setDragId((d) => (d === id ? null : d));
          cleanup.current = null;
        },
        commit ? SETTLE_MS + 20 : 0,
      );
      if (commit && live.current.map((s) => s.id).join(',') !== before) void save(live.current);
    };
    const up = () => finish(true);
    const cancel = () => finish(true);

    const prevSelect = document.body.style.userSelect;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.userSelect = 'none';
    document.body.style.overscrollBehavior = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('touchmove', stopScroll, { passive: false });
    cleanup.current = () => finish(false);
  }

  const dragged = dragId ? items.find((s) => s.id === dragId) : undefined;
  const draggedIndex = dragId ? items.findIndex((s) => s.id === dragId) : -1;

  return (
    <div>
      <ol className="flex flex-col gap-2">
        {items.map((c, i) => {
          const isDragged = dragId === c.id;
          return (
            <li
              key={c.id}
              ref={(el) => {
                if (el) rows.current.set(c.id, el);
                else rows.current.delete(c.id);
              }}
              className={`flex items-center gap-2 rounded-xl p-2 ring-1 ${isDragged ? 'bg-brand/5 opacity-40 ring-2 ring-dashed ring-brand-deep/60' : 'bg-white shadow-sm ring-ink/10'}`}
            >
              <button
                type="button"
                aria-label={`Drag ${c.title} to a new place`}
                onPointerDown={(e) => startDrag(e, c.id)}
                className="flex h-12 w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-xl text-ink/60 active:bg-brand/10"
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
          );
        })}
      </ol>

      {/* The copy under the thumb. Its position is written straight to its style while dragging. */}
      {dragged && (
        <div
          ref={ghost}
          aria-hidden
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-xl bg-white p-2 opacity-0 shadow-2xl ring-2 ring-brand-deep"
          style={{ left: 0, top: 0, transition: 'transform 110ms ease, opacity 80ms ease' }}
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
