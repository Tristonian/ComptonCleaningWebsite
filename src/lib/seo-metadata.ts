import 'server-only';
import type { Metadata } from 'next';
import { getEnv } from '@/lib/env';
import { SEO_COPY, SITE_NAME, absoluteUrl, homeAlternates } from '@/lib/seo';

export function siteOrigin(): string {
  return (getEnv('SITE_URL') ?? 'https://comptoncleaning.co.uk').replace(/\/+$/, '');
}

/** Title, description, canonical, hreflang and social cards for `/` (en) and `/cy`. */
export function homeMetadata(locale: 'en' | 'cy'): Metadata {
  const origin = siteOrigin();
  const copy = SEO_COPY[locale];
  const languages = homeAlternates(origin);
  const url = locale === 'cy' ? languages.cy : languages.en;
  const logo = absoluteUrl(origin, '/ccs-logo.png');
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: locale === 'cy' ? 'cy_GB' : 'en_GB',
      url,
      title: copy.title,
      description: copy.description,
      images: [{ url: logo, width: 1482, height: 778, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title: copy.title, description: copy.description, images: [logo] },
  };
}
