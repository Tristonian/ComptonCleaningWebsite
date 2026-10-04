import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailDomainCanReceive, postcodeExists } from './verify';

function mockFetch(handler: (url: string) => { status?: number; body?: unknown } | 'throw') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const r = handler(String(url));
      if (r === 'throw') throw new Error('network');
      return { status: r.status ?? 200, json: async () => r.body } as Response;
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('postcodeExists', () => {
  it('true for a real postcode, false for an unknown one', async () => {
    mockFetch(() => ({ body: { status: 200, result: true } }));
    expect(await postcodeExists('BS16 1AA')).toBe(true);
    mockFetch(() => ({ body: { status: 200, result: false } }));
    expect(await postcodeExists('BS99 9ZZ')).toBe(false);
  });
  it('fails open (null) when the service errors or is down', async () => {
    mockFetch(() => ({ status: 500 }));
    expect(await postcodeExists('BS16 1AA')).toBeNull();
    mockFetch(() => 'throw');
    expect(await postcodeExists('BS16 1AA')).toBeNull();
  });
});

describe('emailDomainCanReceive', () => {
  it('true when the domain has MX records', async () => {
    mockFetch(() => ({ body: { Status: 0, Answer: [{ type: 15 }] } }));
    expect(await emailDomainCanReceive('jo@gmail.com')).toBe(true);
  });
  it('false when the domain does not exist (typo)', async () => {
    mockFetch(() => ({ body: { Status: 3 } }));
    expect(await emailDomainCanReceive('jo@gmial.con')).toBe(false);
  });
  it('falls back to an A record when there is no MX', async () => {
    mockFetch((url) => (url.includes('type=MX') ? { body: { Status: 0 } } : { body: { Status: 0, Answer: [{ type: 1 }] } }));
    expect(await emailDomainCanReceive('jo@example.org')).toBe(true);
  });
  it('false when there is neither MX nor A', async () => {
    mockFetch(() => ({ body: { Status: 0 } }));
    expect(await emailDomainCanReceive('jo@parked.example')).toBe(false);
  });
  it('fails open (null) when DNS cannot be reached', async () => {
    mockFetch(() => 'throw');
    expect(await emailDomainCanReceive('jo@gmail.com')).toBeNull();
    mockFetch(() => ({ status: 503 }));
    expect(await emailDomainCanReceive('jo@gmail.com')).toBeNull();
  });
});
