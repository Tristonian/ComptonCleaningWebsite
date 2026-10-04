/**
 * Lookups that confirm a postcode and an email domain really exist. Both FAIL OPEN: if the lookup
 * service is down, slow or confused we return null ("unknown") and the enquiry is accepted, because
 * losing a real customer is worse than letting through a typo. Only a clear "no" returns false.
 * Free, no keys: postcodes.io for postcodes, Cloudflare's DNS-over-HTTPS for email domains.
 */

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 3500): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON body: status is still useful.
    }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/** true = a real postcode, false = definitely not, null = could not tell. */
export async function postcodeExists(postcode: string): Promise<boolean | null> {
  const r = await getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ''))}/validate`);
  if (!r || r.status !== 200) return null;
  const result = (r.body as { result?: unknown } | null)?.result;
  return typeof result === 'boolean' ? result : null;
}

async function dns(name: string, type: 'MX' | 'A'): Promise<{ status: number; answers: number } | null> {
  const r = await getJson(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { accept: 'application/dns-json' },
  );
  if (!r || r.status !== 200) return null;
  const b = r.body as { Status?: number; Answer?: unknown[] } | null;
  if (!b || typeof b.Status !== 'number') return null;
  return { status: b.Status, answers: Array.isArray(b.Answer) ? b.Answer.length : 0 };
}

/**
 * true = the domain can receive mail (has MX, or at least an A record), false = it does not
 * exist or has neither, null = could not tell. Catches typos like "gmial.con".
 */
export async function emailDomainCanReceive(email: string): Promise<boolean | null> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  const mx = await dns(domain, 'MX');
  if (!mx) return null;
  if (mx.status === 3) return false; // NXDOMAIN
  if (mx.status === 0 && mx.answers > 0) return true;
  // No MX: mail can still go to the domain's own address (RFC 5321), so try an A record.
  const a = await dns(domain, 'A');
  if (!a) return null;
  if (a.status === 3) return false;
  return a.status === 0 && a.answers > 0 ? true : false;
}
