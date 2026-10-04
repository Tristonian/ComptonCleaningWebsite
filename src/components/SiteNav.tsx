'use client';

import { useState } from 'react';
import { Ed } from '@/components/Ed';
import { LangSwitch } from '@/components/LangSwitch';

/**
 * Hamburger over the hero (sketch: "hamburger menu cropped to that point of the page"); once the
 * hero has scrolled away, the sticky bar below takes over with the same four anchors.
 */
export function HeroMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between px-4 pt-4">
      <LangSwitchOnBrand />
      <div className="relative">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/50"
        >
          <span className="h-0.5 w-5 bg-white" />
          <span className="h-0.5 w-5 bg-white" />
          <span className="h-0.5 w-5 bg-white" />
        </button>
        {open && (
          <ul className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl bg-white text-ink shadow-xl">
            <NavItems onPick={() => setOpen(false)} />
          </ul>
        )}
      </div>
    </div>
  );
}

function LangSwitchOnBrand() {
  return (
    <div className="rounded-full bg-white">
      <LangSwitch />
    </div>
  );
}

export function StickyBar() {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink/10 bg-white/90 backdrop-blur">
      <ul className="mx-auto flex max-w-2xl justify-around px-2 text-sm font-bold text-brand-deep">
        <NavItems />
      </ul>
    </nav>
  );
}

function NavItems({ onPick }: { onPick?: () => void }) {
  const link = 'block px-3 py-3';
  return (
    <>
      <li>
        <a href="#services" onClick={onPick} className={link}>
          <Ed id="nav.services">Services</Ed>
        </a>
      </li>
      <li>
        <a href="#prices" onClick={onPick} className={link}>
          <Ed id="nav.prices">Prices</Ed>
        </a>
      </li>
      <li>
        <a href="#contact" onClick={onPick} className={link}>
          <Ed id="nav.contact">Contact us</Ed>
        </a>
      </li>
      <li>
        <a href="#reviews" onClick={onPick} className={link}>
          <Ed id="nav.reviews">Reviews</Ed>
        </a>
      </li>
    </>
  );
}
