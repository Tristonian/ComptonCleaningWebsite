import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { EditModeProvider } from '@/components/EditMode';
import { getAdmin } from '@/lib/auth/session';
import { getOverrides } from '@/lib/content/store';
import { isLocale } from '@/lib/content/shared';
import { getEnv } from '@/lib/env';
import { isIndexable } from '@/lib/seo';
import { siteOrigin } from '@/lib/seo-metadata';

// Fallbacks for pages without their own metadata. Staging is kept out of search results here as
// well as in robots.txt (a Disallow alone does not stop a URL being indexed).
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: 'Compton Cleaning | Window cleaning', template: '%s' },
    description: 'Regular, affordably priced window cleaning in Bristol, Chepstow, Caldicot and Newport.',
    ...(isIndexable(getEnv('APP_ENV')) ? {} : { robots: { index: false, follow: false } }),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e8abe',
};

// Overrides and the admin check are per-request, so the site renders dynamically. At this size
// that is fine; cache with tags later if it is ever measurably slow (NEXT_STEPS).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requested = (await headers()).get('x-locale');
  const locale = isLocale(requested) ? requested : 'en';

  let canEdit = false;
  try {
    canEdit = Boolean(await getAdmin());
  } catch (err) {
    console.error('[layout] admin check failed, rendering as a visitor:', err);
  }
  const overrides = await getOverrides(locale);

  return (
    <html lang={locale}>
      <body>
        <EditModeProvider locale={locale} overrides={overrides} canEdit={canEdit}>
          {children}
        </EditModeProvider>
      </body>
    </html>
  );
}
