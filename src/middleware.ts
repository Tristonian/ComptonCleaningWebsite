import { NextResponse, type NextRequest } from 'next/server';
import { localeFromPath } from '@/lib/content/shared';

/**
 * Tells the root layout which language this request is in (ADR 0004), so `<html lang>` and the
 * pencil's overrides are right without every page having to pass a locale down. Runs on the
 * edge runtime, so it must stay free of Node/Worker-binding imports.
 */
export function middleware(req: NextRequest) {
  // www -> apex, permanently (one address for search engines and for the OAuth redirect URI).
  if (req.nextUrl.hostname.startsWith('www.')) {
    const url = req.nextUrl.clone();
    url.hostname = url.hostname.slice(4);
    return NextResponse.redirect(url, 301);
  }
  const headers = new Headers(req.headers);
  headers.set('x-locale', localeFromPath(req.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon|.*\\..*).*)'],
};
