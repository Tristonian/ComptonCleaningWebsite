// Pure, dependency-free helpers shared by server and client code (and unit tested).

export const LOCALES = ['en', 'cy'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}

/** Mirrors LesK's rule. Lower-case dotted ids such as `home.hero.title`; no spaces, no slashes. */
const KEY = /^[a-z0-9]([a-z0-9._-]{0,78}[a-z0-9])?$/;
export function isValidNodeKey(key: unknown): key is string {
  return typeof key === 'string' && KEY.test(key);
}

export const MAX_VALUE_LENGTH = 2000;

export type ValueCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Plain text only. The pencil never stores HTML (ADR 0004): values render as React text nodes,
 * so markup would show literally, and rejecting control characters stops invisible junk.
 */
export function checkValue(raw: unknown): ValueCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'That is not text.' };
  const value = raw.trim();
  if (!value) return { ok: false, error: 'This cannot be empty. Use Revert to restore the original.' };
  if (value.length > MAX_VALUE_LENGTH) {
    return { ok: false, error: `That is longer than ${MAX_VALUE_LENGTH} characters.` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    return { ok: false, error: 'That contains characters that cannot be saved.' };
  }
  return { ok: true, value };
}

/** Locale from a URL path: `/cy` and `/cy/...` are Welsh, everything else English. */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/cy' || pathname.startsWith('/cy/') ? 'cy' : 'en';
}

/** The same page in the other language. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const bare = localeFromPath(pathname) === 'cy' ? pathname.slice(3) || '/' : pathname;
  if (to === 'en') return bare;
  return bare === '/' ? '/cy' : `/cy${bare}`;
}
