'use client';

import { usePathname } from 'next/navigation';
import { localeFromPath, switchLocalePath } from '@/lib/content/shared';

/**
 * A plain anchor, not next/link, on purpose: the root layout holds the language and the pencil's
 * overrides, and Next does not re-render a layout on a soft navigation, so a client-side hop
 * between `/` and `/cy` changed the URL but left the page in the old language. A full page load
 * is the right behaviour here, it works without JS, and it is crawlable (hreflang later).
 */
export function LangSwitch() {
  const pathname = usePathname() || '/';
  const current = localeFromPath(pathname);
  const target = current === 'en' ? 'cy' : 'en';
  return (
    <a
      href={switchLocalePath(pathname, target)}
      hrefLang={target}
      lang={target}
      className="rounded-full px-3 py-1 text-sm font-semibold text-brand-deep ring-1 ring-brand/30"
    >
      {target === 'cy' ? 'Cymraeg' : 'English'}
    </a>
  );
}
