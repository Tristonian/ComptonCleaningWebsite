// Entry point for the Worker (wrangler.jsonc "main"). Wraps the OpenNext worker with a small edge
// cache, because the free Workers plan allows 10ms of CPU per request and rendering the home page
// on every visit (plus every image request) was exceeding it. See docs/adr/0013-edge-cache.md.
//
// - Public pages (/, /cy, /privacy, /cy/privacy): cached 60s per data centre, ONLY for visitors
//   with no session cookie, so Sam (admin, pencil mode) always gets a live render.
// - /img/<hash>: content-addressed, so cached for a year (the route already says so).
// - robots.txt, sitemap.xml: cached an hour.
// - Any POST from a signed-in browser (an admin save) clears the page copies in that data centre.
import handler from '../.open-next/worker.js';
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js';

const SESSION_COOKIE = 'cc_session';
const PAGES = new Set(['/', '/cy', '/privacy', '/cy/privacy']);
const PAGE_TTL = 60;

function ttlFor(pathname) {
  if (PAGES.has(pathname)) return PAGE_TTL;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return 3600;
  if (pathname.startsWith('/img/')) return 31536000;
  return 0;
}

const hasSession = (req) => (req.headers.get('cookie') ?? '').includes(`${SESSION_COOKIE}=`);
const keyFor = (url) => new Request(`${url.origin}${url.pathname}`, { method: 'GET' });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;

    if (request.method === 'POST' && hasSession(request)) {
      const response = await handler.fetch(request, env, ctx);
      ctx.waitUntil(Promise.all([...PAGES].map((p) => cache.delete(keyFor(new URL(p, url.origin))))));
      return response;
    }

    const ttl = request.method === 'GET' ? ttlFor(url.pathname) : 0;
    if (!ttl || (PAGES.has(url.pathname) && hasSession(request)) || request.headers.has('range')) {
      return handler.fetch(request, env, ctx);
    }

    const key = keyFor(url);
    const hit = await cache.match(key);
    if (hit) {
      const out = new Response(hit.body, hit);
      if (PAGES.has(url.pathname)) out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
      out.headers.set('x-edge-cache', 'HIT');
      return out;
    }

    const response = await handler.fetch(request, env, ctx);
    if (response.status !== 200 || response.headers.has('set-cookie')) return response;

    const stored = new Response(response.clone().body, response);
    stored.headers.set('Cache-Control', `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, stored));

    const out = new Response(response.body, response);
    if (PAGES.has(url.pathname)) out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    out.headers.set('x-edge-cache', 'MISS');
    return out;
  },
};
