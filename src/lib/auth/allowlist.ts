/**
 * Admin allow-list (ADR 0003). A valid Google login is never enough on its own.
 *
 * Google treats gmail.com and googlemail.com as the same mailbox, ignores dots in the local
 * part, and ignores anything after a `+`. So we compare on that canonical form, and ONLY for
 * those two domains: for every other domain dots and `+` are significant and must not be
 * stripped (that would let a.b@corp and ab@corp collide).
 */
export function normaliseEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.split('+')[0].replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

export function parseAllowList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map(normaliseEmail),
  );
}

export function isAllowed(email: string | undefined | null, allowList: Set<string>): boolean {
  if (!email) return false;
  return allowList.has(normaliseEmail(email));
}
