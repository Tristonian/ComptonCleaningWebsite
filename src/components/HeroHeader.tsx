'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Height of the collapsed bar in px. The sticky nav below sits at this offset (`top-11` = 44px). */
const BAR_H = 44;

/**
 * The hero, which collapses as you scroll: the logo shrinks to 10% and the coloured header
 * settles into a thin bar pinned to the top of the screen for the rest of the page.
 *
 * How it stays jitter-free: the header becomes `position: fixed` and its height is exactly
 * `full - scrollY` (never below BAR_H), so its bottom edge tracks the top of the content as it
 * scrolls. A spacer of the full height keeps the layout from moving, so shrinking the header can
 * never change scrollY. Progress `--p` (0 -> 1) drives the logo size and padding in globals.css.
 * Before hydration it renders as an ordinary in-flow hero, so there is no flash and it degrades to
 * the plain hero without JS. Scroll-linked movement is the user's own scrolling, not an animation,
 * so it is left on under prefers-reduced-motion (nothing here uses transitions or timers).
 */
export function HeroHeader({ children, colour }: { children: React.ReactNode; colour: string | null }) {
  const header = useRef<HTMLElement>(null);
  const [full, setFull] = useState<number | null>(null);
  const fullRef = useRef(0);

  useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;

    const apply = () => {
      const f = fullRef.current;
      const y = Math.max(0, window.scrollY);
      const p = Math.min(1, y / Math.max(1, f - BAR_H));
      el.style.setProperty('--p', String(p));
      el.style.height = `${Math.max(BAR_H, f - y)}px`;
      el.dataset.collapsed = p > 0.5 ? '1' : '0';
    };

    // Natural height depends on width (text wrapping), so re-measure on resize, at progress 0.
    const measure = () => {
      el.style.setProperty('--p', '0');
      el.style.height = 'auto';
      fullRef.current = el.offsetHeight;
      setFull(fullRef.current);
      apply();
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Fonts/images can change the natural height after first paint; measure once more when loaded.
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const onLoad = () => window.dispatchEvent(new Event('resize'));
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return (
    <div style={full ? { height: full } : undefined}>
      <header
        ref={header}
        className={`hero overflow-hidden px-4 text-center text-white ${full ? 'fixed inset-x-0 top-0 z-40' : 'relative'}`}
        style={colour ? ({ '--hero-bg': colour } as React.CSSProperties) : undefined}
      >
        {children}
      </header>
    </div>
  );
}
