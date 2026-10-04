'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localeFromPath, switchLocalePath } from '@/lib/content/shared';

/** Plain links between the two languages: works without JS and is crawlable (hreflang later). */
export function LangSwitch() {
  const pathname = usePathname() || '/';
  const current = localeFromPath(pathname);
  const target = current === 'en' ? 'cy' : 'en';
  return (
    <Link
      href={switchLocalePath(pathname, target)}
      hrefLang={target}
      lang={target}
      className="rounded-full px-3 py-1 text-sm font-semibold text-brand-deep ring-1 ring-brand/30"
    >
      {target === 'cy' ? 'Cymraeg' : 'English'}
    </Link>
  );
}
