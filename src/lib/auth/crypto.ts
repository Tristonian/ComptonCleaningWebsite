// Web Crypto helpers (available in Workers and Node 22). No Node-only APIs on purpose.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function utf8ToBase64Url(text: string): string {
  return toBase64Url(enc.encode(text));
}

export function base64UrlToUtf8(input: string): string {
  return dec.decode(fromBase64Url(input));
}

export function randomToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Base64Url(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ]);
}

/** `payload.signature`, both base64url. The payload is readable; it is integrity-protected only. */
export async function signPayload(payload: unknown, secret: string): Promise<string> {
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Returns the payload, or null if the signature is wrong or the value is malformed. */
export async function verifyPayload<T>(signed: string, secret: string): Promise<T | null> {
  const dot = signed.indexOf('.');
  if (dot < 1 || signed.indexOf('.', dot + 1) !== -1) return null;
  const body = signed.slice(0, dot);
  let sig: Uint8Array;
  try {
    sig = fromBase64Url(signed.slice(dot + 1));
  } catch {
    return null;
  }
  // crypto.subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    sig as BufferSource,
    enc.encode(body),
  );
  if (!ok) return null;
  try {
    return JSON.parse(base64UrlToUtf8(body)) as T;
  } catch {
    return null;
  }
}
