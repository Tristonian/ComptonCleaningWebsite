import { beforeAll, describe, expect, it } from 'vitest';
import { buildAuthUrl, IdTokenError, newOAuthStart, verifyIdToken, type Jwk } from './google';
import { sha256Base64Url, toBase64Url } from './crypto';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NONCE = 'nonce-123';
const NOW = 1_800_000_000;

let jwks: Jwk[];
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

async function makeKeys(kid: string) {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk;
  pub.kid = kid;
  return { pub, priv: pair.privateKey };
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function sign(
  claims: Record<string, unknown>,
  key = privateKey,
  header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' },
) {
  const signingInput = `${b64(header)}.${b64(claims)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;
}

const good = () => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '123',
  exp: NOW + 600,
  email: 'sam@gmail.com',
  email_verified: true,
  nonce: NONCE,
});

const verify = (token: string) =>
  verifyIdToken(token, { clientId: CLIENT_ID, nonce: NONCE, jwks, nowSeconds: NOW });

beforeAll(async () => {
  const a = await makeKeys('k1');
  const b = await makeKeys('k1'); // same kid, different key: a forged signature
  jwks = [a.pub];
  privateKey = a.priv;
  otherPrivateKey = b.priv;
});

describe('verifyIdToken', () => {
  it('accepts a valid token', async () => {
    const claims = await verify(await sign(good()));
    expect(claims.email).toBe('sam@gmail.com');
  });
  it('accepts the bare-host issuer Google also uses', async () => {
    await expect(verify(await sign({ ...good(), iss: 'accounts.google.com' }))).resolves.toBeTruthy();
  });
  it('rejects a signature from the wrong key', async () => {
    await expect(verify(await sign(good(), otherPrivateKey))).rejects.toThrow('bad signature');
  });
  it('rejects an unknown kid', async () => {
    await expect(verify(await sign(good(), privateKey, { alg: 'RS256', kid: 'nope' }))).rejects.toThrow(
      'unknown signing key',
    );
  });
  it('rejects alg none / HS256 (algorithm confusion)', async () => {
    await expect(verify(await sign(good(), privateKey, { alg: 'none', kid: 'k1' }))).rejects.toThrow(
      'unexpected algorithm',
    );
    await expect(verify(await sign(good(), privateKey, { alg: 'HS256', kid: 'k1' }))).rejects.toThrow(
      'unexpected algorithm',
    );
  });
  it('rejects wrong issuer, audience, expiry and nonce', async () => {
    await expect(verify(await sign({ ...good(), iss: 'https://evil.example' }))).rejects.toThrow('bad issuer');
    await expect(verify(await sign({ ...good(), aud: 'someone-else' }))).rejects.toThrow('bad audience');
    await expect(verify(await sign({ ...good(), exp: NOW - 1 }))).rejects.toThrow('expired');
    await expect(verify(await sign({ ...good(), nonce: 'other' }))).rejects.toThrow('bad nonce');
    const { nonce: _omit, ...noNonce } = good();
    await expect(verify(await sign(noNonce))).rejects.toThrow('bad nonce');
  });
  it('rejects unverified or missing email', async () => {
    await expect(verify(await sign({ ...good(), email_verified: false }))).rejects.toThrow('email not verified');
    const { email: _omit, ...noEmail } = good();
    await expect(verify(await sign(noEmail))).rejects.toThrow('email not verified');
  });
  it('rejects malformed tokens', async () => {
    await expect(verify('a.b')).rejects.toBeInstanceOf(IdTokenError);
    await expect(verify('!!.!!.!!')).rejects.toBeInstanceOf(IdTokenError);
  });
});

describe('buildAuthUrl', () => {
  it('carries PKCE (S256), state, nonce and the basic scopes only', async () => {
    const start = newOAuthStart();
    const url = new URL(
      await buildAuthUrl({ clientId: CLIENT_ID, redirectUri: 'http://localhost:3000/cb', start }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(await sha256Base64Url(start.verifier));
    expect(url.searchParams.get('state')).toBe(start.state);
    expect(url.searchParams.get('nonce')).toBe(start.nonce);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('response_type')).toBe('code');
    // The verifier itself must never appear in the URL.
    expect(url.toString()).not.toContain(start.verifier);
  });
});
