'use client';

import { useState } from 'react';
import { Ed } from '@/components/Ed';
import { LangSwitch } from '@/components/LangSwitch';

/**
 * Hamburger over the hero (sketch: "hamburger menu cropped to that point of the page"); once the
 * hero has scrolled away, the sticky bar below takes over with the same four anchors.
 */
export function HeroMenu({ hidden = [] }: { hidden?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hero-fade absolute left-4 top-4 z-40 rounded-full bg-white">
        <LangSwitch />
      </div>
      {/* A bubble fixed to the viewport: it follows the reader down the page. */}
      <div className="fixed right-4 top-4 z-50 print:hidden">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-12 w-12 flex-col items-center justify-center gap-1.5 rounded-full bg-brand-deep shadow-lg ring-2 ring-white/70"
        >
          <span className="h-0.5 w-5 bg-white" />
          <span className="h-0.5 w-5 bg-white" />
          <span className="h-0.5 w-5 bg-white" />
        </button>
        {open && (
          <ul className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl bg-white text-ink shadow-xl">
            <NavItems hidden={hidden} onPick={() => setOpen(false)} />
          </ul>
        )}
      </div>
    </>
  );
}

export function StickyBar({ hidden = [] }: { hidden?: string[] }) {
  return (
    <nav className="sticky top-11 z-30 border-b border-ink/10 bg-white/90 backdrop-blur">
      {/* Right padding keeps the links clear of the fixed menu bubble. */}
      <ul className="mx-auto flex max-w-2xl justify-around pl-2 pr-16 text-sm font-bold text-brand-deep">
        <NavItems hidden={hidden} />
      </ul>
    </nav>
  );
}

/** Links to a section Sam has hidden are left out too. Contact is never hidden. */
function NavItems({ onPick, hidden }: { onPick?: () => void; hidden: string[] }) {
  const link = 'block whitespace-nowrap px-2 py-3';
  const items = [
    { id: 'services', href: '#services', label: <Ed id="nav.services">Services</Ed> },
    { id: 'prices', href: '#prices', label: <Ed id="nav.prices">Prices</Ed> },
    { id: 'contact', href: '#contact', label: <Ed id="nav.contact">Contact us</Ed> },
    { id: 'reviews', href: '#reviews', label: <Ed id="nav.reviews">Reviews</Ed> },
  ];
  return (
    <>
      {items
        .filter((item) => !hidden.includes(item.id))
        .map((item) => (
          <li key={item.id}>
            <a href={item.href} onClick={onPick} className={link}>
              {item.label}
            </a>
          </li>
        ))}
    </>
  );
}
