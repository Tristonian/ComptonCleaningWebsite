import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getEnv, siteUrl } from '@/lib/env';
import { isAllowed, parseAllowList } from './allowlist';
import { randomToken, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'cc_session';
const TTL_SECONDS = 30 * 24 * 60 * 60;
const EXTEND_BELOW_SECONDS = 15 * 24 * 60 * 60;

const nowSeconds = () => Math.floor(Date.now() / 1000);

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
export async function createSession(email: string): Promise<{ token: string; maxAge: number }> {
  const db = getDb();
  const token = randomToken(32);
  const now = nowSeconds();
  await db.batch([
    // Opportunistic cleanup instead of a cron: a handful of rows, runs on every login.
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    db
      .prepare(
        'INSERT INTO sessions (token_hash, email, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(await sha256Hex(token), email, now, now + TTL_SECONDS, now),
  ]);
  return { token, maxAge: TTL_SECONDS };
}

/**
 * Resolve a session token to an admin email, or null. The allow-list is re-checked on EVERY
 * request, so removing someone from ADMIN_ALLOWED_EMAILS locks them out immediately even though
 * their session row still exists.
 */
export async function resolveSession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  const db = getDb();
  const hash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT email, expires_at FROM sessions WHERE token_hash = ?')
    .bind(hash)
    .first<{ email: string; expires_at: number }>();
  if (!row) return null;
  const now = nowSeconds();
  if (row.expires_at <= now) return null;
  if (!isAllowed(row.email, adminAllowList())) return null;

  const remaining = row.expires_at - now;
  await db
    .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
    .bind(now, remaining < EXTEND_BELOW_SECONDS ? now + TTL_SECONDS : row.expires_at, hash)
    .run();
  return { email: row.email };
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
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
