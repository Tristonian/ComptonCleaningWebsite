import { NextResponse } from 'next/server';
import { requireEnv, siteUrl } from '@/lib/env';
import { signPayload } from '@/lib/auth/crypto';
import { buildAuthUrl, newOAuthStart } from '@/lib/auth/google';
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH } from '@/lib/auth/oauth-cookie';
import { secureCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Step 1: send the browser to Google. State + PKCE verifier + nonce ride in a signed cookie. */
export async function GET() {
  const start = newOAuthStart();
  const url = await buildAuthUrl({
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    redirectUri: `${siteUrl()}/api/auth/google/callback`,
    start,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, await signPayload(start, requireEnv('SESSION_SECRET')), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  return res;
}
