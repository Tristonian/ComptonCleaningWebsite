import { NextResponse, type NextRequest } from 'next/server';
import { requireEnv, siteUrl } from '@/lib/env';
import { verifyPayload } from '@/lib/auth/crypto';
import { isAllowed } from '@/lib/auth/allowlist';
import { exchangeCode, fetchGoogleJwks, verifyIdToken, type OAuthStart } from '@/lib/auth/google';
import {
  SESSION_COOKIE,
  adminAllowList,
  createSession,
  sessionCookieOptions,
} from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH } from '@/lib/auth/oauth-cookie';

export const dynamic = 'force-dynamic';

function fail(reason: 'denied' | 'cancelled' | 'failed' | 'expired', detail?: string) {
  if (detail) console.error(`[auth] google login ${reason}: ${detail}`);
  const res = NextResponse.redirect(`${siteUrl()}/admin/login?error=${reason}`);
  res.cookies.set(OAUTH_COOKIE, '', { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}

/** Step 2: Google sends the browser back here with ?code=&state=. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get('error')) return fail('cancelled');

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return fail('failed', 'missing code or state');

  const start = await verifyPayload<OAuthStart>(
    req.cookies.get(OAUTH_COOKIE)?.value ?? '',
    requireEnv('SESSION_SECRET'),
  );
  if (!start) return fail('expired', 'missing or tampered oauth cookie');
  if (start.state !== state) return fail('failed', 'state mismatch');

  try {
    const clientId = requireEnv('GOOGLE_CLIENT_ID');
    const { id_token } = await exchangeCode({
      code,
      verifier: start.verifier,
      clientId,
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirectUri: `${siteUrl()}/api/auth/google/callback`,
    });
    const claims = await verifyIdToken(id_token, {
      clientId,
      nonce: start.nonce,
      jwks: await fetchGoogleJwks(),
    });

    // The gate that matters: Google vouching for someone is not enough.
    if (!isAllowed(claims.email, adminAllowList())) {
      await getDb().query('INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', [
        claims.email,
        'login_denied',
        'not on allow-list',
      ]);
      return fail('denied');
    }

    const { token, maxAge } = await createSession(claims.email);
    await getDb().query('INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', [
      claims.email,
      'login',
      null,
    ]);

    const res = NextResponse.redirect(`${siteUrl()}/admin`);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    res.cookies.set(OAUTH_COOKIE, '', { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return res;
  } catch (err) {
    return fail('failed', err instanceof Error ? err.message : String(err));
  }
}
