import { base64UrlToUtf8, fromBase64Url, sha256Base64Url, randomToken } from './crypto';

/**
 * Google OAuth 2.0 authorization-code flow with PKCE (ADR 0003). Pure functions where
 * possible so the security-relevant checks are unit tested without network or Workers.
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export type OAuthStart = { state: string; verifier: string; nonce: string };

export function newOAuthStart(): OAuthStart {
  return { state: randomToken(16), verifier: randomToken(32), nonce: randomToken(16) };
}

export async function buildAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  start: OAuthStart;
}): Promise<string> {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: args.start.state,
    nonce: args.start.nonce,
    code_challenge: await sha256Base64Url(args.start.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export type Jwk = JsonWebKey & { kid?: string };

export type IdTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  nonce?: string;
  name?: string;
};

export class IdTokenError extends Error {}

/**
 * Verify a Google ID token: RS256 signature against Google's published keys, then issuer,
 * audience, expiry, nonce and verified email. Never trust a decoded-but-unverified token, even
 * one received directly from the token endpoint.
 */
export async function verifyIdToken(
  idToken: string,
  opts: { clientId: string; nonce: string; jwks: Jwk[]; nowSeconds?: number },
): Promise<IdTokenClaims & { email: string }> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new IdTokenError('malformed token');
  const [h, p, s] = parts;

  let header: { alg?: string; kid?: string };
  let claims: IdTokenClaims;
  try {
    header = JSON.parse(base64UrlToUtf8(h));
    claims = JSON.parse(base64UrlToUtf8(p));
  } catch {
    throw new IdTokenError('malformed token');
  }

  if (header.alg !== 'RS256') throw new IdTokenError('unexpected algorithm');
  const jwk = opts.jwks.find((k) => k.kid && k.kid === header.kid);
  if (!jwk) throw new IdTokenError('unknown signing key');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    fromBase64Url(s) as BufferSource,
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new IdTokenError('bad signature');

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(claims.iss)) throw new IdTokenError('bad issuer');
  if (claims.aud !== opts.clientId) throw new IdTokenError('bad audience');
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new IdTokenError('expired');
  if (!claims.nonce || claims.nonce !== opts.nonce) throw new IdTokenError('bad nonce');
  if (!claims.email || claims.email_verified !== true) throw new IdTokenError('email not verified');

  return claims as IdTokenClaims & { email: string };
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

export async function fetchGoogleJwks(fetchImpl: typeof fetch = fetch): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetchImpl(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: now };
  return body.keys;
}

export async function exchangeCode(args: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{ id_token: string }> {
  const res = await (args.fetchImpl ?? fetch)(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: args.verifier,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error('token exchange returned no id_token');
  return { id_token: body.id_token };
}
