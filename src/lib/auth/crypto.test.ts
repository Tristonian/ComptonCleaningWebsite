import { describe, expect, it } from 'vitest';
import { randomToken, sha256Hex, signPayload, verifyPayload } from './crypto';

describe('signPayload / verifyPayload', () => {
  const secret = 'a-test-secret-that-is-long-enough';
  const payload = { state: 's', verifier: 'v', nonce: 'n' };

  it('round-trips', async () => {
    expect(await verifyPayload(await signPayload(payload, secret), secret)).toEqual(payload);
  });
  it('rejects a different secret', async () => {
    expect(await verifyPayload(await signPayload(payload, secret), 'other-secret')).toBeNull();
  });
  it('rejects a tampered payload', async () => {
    const [body, sig] = (await signPayload(payload, secret)).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, state: 'evil' })).toString('base64url');
    expect(forged).not.toBe(body);
    expect(await verifyPayload(`${forged}.${sig}`, secret)).toBeNull();
  });
  it('rejects malformed values without throwing', async () => {
    for (const bad of ['', 'nodot', 'a.b.c', '.', 'a.', '.b', '!!!.???']) {
      expect(await verifyPayload(bad, secret)).toBeNull();
    }
  });
});

describe('helpers', () => {
  it('randomToken is unique and url-safe', () => {
    const a = randomToken();
    expect(a).not.toBe(randomToken());
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('sha256Hex matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
