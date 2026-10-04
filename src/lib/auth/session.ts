import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, type Db } from '@/lib/db';
import { getEnv, siteUrl } from '@/lib/env';
import { isAllowed, parseAllowList } from './allowlist';
import { randomToken, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'cc_session';
const TTL_SECONDS = 30 * 24 * 60 * 60;
const EXTEND_BELOW_SECONDS = 15 * 24 * 60 * 60;

export function secureCookies(): boolean {
  return siteUrl().startsWith('https://');
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function adminAllowList(): Set<string> {
  return parseAllowList(getEnv('ADMIN_ALLOWED_EMAILS'));
}

/** Mint a session. Only the SHA-256 of the token is stored (ADR 0003). */
export async function createSession(email: string, db: Db = getDb()): Promise<{ token: string; maxAge: number }> {
  const token = randomToken(32);
  await db.transaction([
    // Opportunistic cleanup instead of a cron: a handful of rows, runs on every login.
    { text: 'DELETE FROM sessions WHERE expires_at < now()' },
    {
      text: `INSERT INTO sessions (token_hash, email, created_at, expires_at, last_seen_at)
             VALUES ($1, $2, now(), now() + make_interval(secs => $3), now())`,
      params: [await sha256Hex(token), email, TTL_SECONDS],
    },
  ]);
  return { token, maxAge: TTL_SECONDS };
}

/**
 * Resolve a session token to an admin email, or null. The allow-list is re-checked on EVERY
 * request, so removing someone from ADMIN_ALLOWED_EMAILS locks them out immediately even though
 * their session row still exists.
 */
export async function resolveSession(token: string | undefined, db: Db = getDb()): Promise<{ email: string } | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const rows = await db.query<{ email: string }>(
    'SELECT email FROM sessions WHERE token_hash = $1 AND expires_at > now()',
    [hash],
  );
  const row = rows[0];
  if (!row) return null;
  if (!isAllowed(row.email, adminAllowList())) return null;

  // Slide the expiry forward once less than half the lifetime is left.
  await db.query(
    `UPDATE sessions SET last_seen_at = now(),
         expires_at = CASE WHEN expires_at - now() < make_interval(secs => $2)
                           THEN now() + make_interval(secs => $3) ELSE expires_at END
       WHERE token_hash = $1`,
    [hash, EXTEND_BELOW_SECONDS, TTL_SECONDS],
  );
  return { email: row.email };
}

export async function deleteSession(token: string | undefined, db: Db = getDb()): Promise<void> {
  if (!token) return;
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [await sha256Hex(token)]);
}

/** The signed-in admin for this request, or null. Safe to call from any server component. */
export async function getAdmin(): Promise<{ email: string } | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<{ email: string }> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
