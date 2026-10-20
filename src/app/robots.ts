import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/env';
import { isIndexable } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable(getEnv('APP_ENV'))) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  const origin = (getEnv('SITE_URL') ?? 'https://comptoncleaning.co.uk').replace(/\/+$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
