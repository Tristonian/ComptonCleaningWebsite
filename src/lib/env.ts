import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Read a config value. Order: process.env (local .env.local and Worker vars/secrets under
 * nodejs_compat), then the Worker binding env. Empty strings count as ABSENT: a Worker secret
 * can exist with an empty value and `wrangler secret list` will not say so (see ADR 0001).
 */
export function getEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  try {
    const bound = (getCloudflareContext().env as unknown as Record<string, unknown>)[name];
    if (typeof bound === 'string' && bound) return bound;
  } catch {
    // Outside a request context (e.g. build time): fall through.
  }
  return undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing or empty config value: ${name}`);
  return value;
}

export function isProductionEnv(): boolean {
  return getEnv('APP_ENV') === 'production';
}

/** Absolute site origin, no trailing slash. Used for OAuth redirect URIs (never the Host header). */
export function siteUrl(): string {
  return requireEnv('SITE_URL').replace(/\/+$/, '');
}
