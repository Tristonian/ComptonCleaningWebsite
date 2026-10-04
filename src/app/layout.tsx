import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { EditModeProvider } from '@/components/EditMode';
import { getAdmin } from '@/lib/auth/session';
import { getOverrides } from '@/lib/content/store';
import { isLocale } from '@/lib/content/shared';

export const metadata: Metadata = {
  title: 'Compton Cleaning | Window cleaning',
  description: 'Reliable, insured local window cleaning. 4-weekly, 8-weekly and one-off cleans.',
};

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
