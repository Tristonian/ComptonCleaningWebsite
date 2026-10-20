import { PHONE_TEL, REVIEW_URL } from '@/lib/business';

/** Pure SEO helpers (no env or database access) so they can be unit tested. */

export const SITE_NAME = 'Compton Cleaning Services';

export const SEO_COPY = {
  en: {
    title: 'Window Cleaning in Bristol, Chepstow, Caldicot & Newport | Compton Cleaning',
    description:
      'Regular, affordably priced window cleaning in Bristol, Chepstow, Caldicot and Newport, especially BS16 and BS5. Gutter cleaning, pressure washing and render cleaning too. Call or message for a quote.',
  },
  cy: {
    title: 'Glanhau Ffenestri ym Mryste, Cas-gwent, Caldicot a Chasnewydd | Compton Cleaning',
    description:
      'Glanhau ffenestri rheolaidd am bris teg ym Mryste, Cas-gwent, Caldicot a Chasnewydd. Glanhau cwteri, golchi pwysedd a glanhau rendr hefyd. Ffoniwch neu anfonwch neges am ddyfynbris.',
  },
} as const;

export const AREAS_SERVED = ['Bristol', 'Lyde Green', 'Chepstow', 'Caldicot', 'Newport'] as const;

/** Only production may be indexed: staging is a copy of the site and must never compete with it. */
export function isIndexable(appEnv: string | undefined): boolean {
  return appEnv === 'production';
}

export function absoluteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path === '/' ? '/' : path}`;
}

/** hreflang alternates for the two language versions of the home page. */
export function homeAlternates(origin: string) {
  const en = absoluteUrl(origin, '/');
  const cy = absoluteUrl(origin, '/cy');
  return { en, cy, 'x-default': en };
}

type LocalBusinessArgs = {
  origin: string;
  locale: 'en' | 'cy';
  logoUrl: string;
  serviceNames: string[];
  description: string;
};

/**
 * LocalBusiness structured data. Deliberately omits anything not verified with Sam: no street
 * address, opening hours, ratings or review counts (never invented; see CLAUDE.md on trust claims).
 */
export function localBusinessJsonLd({ origin, locale, logoUrl, serviceNames, description }: LocalBusinessArgs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': `${origin}/#business`,
    name: SITE_NAME,
    url: absoluteUrl(origin, locale === 'cy' ? '/cy' : '/'),
    description,
    image: logoUrl,
    logo: logoUrl,
    telephone: PHONE_TEL.replace('tel:', ''),
    inLanguage: locale === 'cy' ? 'cy-GB' : 'en-GB',
    areaServed: AREAS_SERVED.map((name) => ({ '@type': 'City', name })),
    address: { '@type': 'PostalAddress', addressLocality: 'Bristol', addressCountry: 'GB' },
    sameAs: [REVIEW_URL],
    makesOffer: serviceNames.map((name) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name },
    })),
  };
}

/** Safe to inline in a <script>: stops a stored string closing the tag early. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
