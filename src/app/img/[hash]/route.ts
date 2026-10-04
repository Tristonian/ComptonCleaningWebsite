import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isImageHash } from '@/lib/appearance-shared';

/**
 * Serves an uploaded logo from R2. The key is a content hash, so the bytes behind a URL never
 * change and the response is cached for a year (ADR 0002). Only keys shaped like a hash are
 * looked up, and only the `logo/` prefix, so this cannot be used to read anything else in the bucket.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!isImageHash(hash)) return new Response('Not found', { status: 404 });

  const object = await getCloudflareContext().env.SITE_IMAGES.get(`logo/${hash}`);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
