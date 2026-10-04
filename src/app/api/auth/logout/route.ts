import { NextResponse, type NextRequest } from 'next/server';
import { siteUrl } from '@/lib/env';
import { SESSION_COOKIE, deleteSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST only, and the Origin must be our own site (CSRF belt and braces on top of SameSite=Lax). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== siteUrl()) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  await deleteSession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(`${siteUrl()}/admin/login`, 303);
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
