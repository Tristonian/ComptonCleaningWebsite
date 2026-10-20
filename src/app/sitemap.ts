import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/env';
import { absoluteUrl, homeAlternates } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = (getEnv('SITE_URL') ?? 'https://comptoncleaning.co.uk').replace(/\/+$/, '');
  const languages = homeAlternates(origin);
  return [
    { url: languages.en, changeFrequency: 'monthly', priority: 1, alternates: { languages } },
    { url: languages.cy, changeFrequency: 'monthly', priority: 0.8, alternates: { languages } },
    { url: absoluteUrl(origin, '/privacy'), changeFrequency: 'yearly', priority: 0.2 },
  ];
}
