import 'server-only';
import { getDb, type Db } from '@/lib/db';
import {
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOGO_SRC,
  isImageHash,
  logoSrc,
  normaliseHex,
} from '@/lib/appearance-shared';

/**
 * Logo and hero colour (overrides-only, like content). Image bytes live in R2 under their content
 * hash; this module only knows the rows. Every change writes an audit row in the SAME transaction.
 * The database is passed in so tests can run it against PGlite.
 */

export type Logo = { src: string; width: number; height: number };
export type Appearance = { logo: Logo; heroColour: string | null };
export type StoredLogo = { hash: string; width: number; height: number; label: string; createdAt: string };
export type Result = { ok: true } | { ok: false; error: string };

export const DEFAULT_LOGO: Logo = { src: DEFAULT_LOGO_SRC, ...DEFAULT_LOGO_SIZE };

/** Any failure renders the site as shipped: a brochure site never shows an error for a DB hiccup. */
export async function getAppearance(db: Db = getDb()): Promise<Appearance> {
  try {
    const settings = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key IN ('logo', 'hero_colour')",
    );
    const get = (k: string) => settings.find((s) => s.key === k)?.value;
    const heroColour = normaliseHex(get('hero_colour'));
    const hash = get('logo');
    let logo = DEFAULT_LOGO;
    if (isImageHash(hash)) {
      const rows = await db.query<{ width: number; height: number }>(
        'SELECT width, height FROM site_images WHERE hash = $1',
        [hash],
      );
      if (rows[0]) logo = { src: logoSrc(hash), width: rows[0].width, height: rows[0].height };
    }
    return { logo, heroColour };
  } catch (err) {
    console.error('[appearance] getAppearance failed, rendering defaults:', err);
    return { logo: DEFAULT_LOGO, heroColour: null };
  }
}

export async function listLogos(db: Db = getDb()): Promise<{ logos: StoredLogo[]; activeHash: string | null }> {
  const rows = await db.query<{ hash: string; width: number; height: number; label: string; created_at: string }>(
    'SELECT hash, width, height, label, created_at FROM site_images ORDER BY created_at DESC',
  );
  const active = await db.query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'logo'");
  return {
    logos: rows.map((r) => ({
      hash: r.hash,
      width: r.width,
      height: r.height,
      label: r.label,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    activeHash: active[0]?.value ?? null,
  };
}

const audit = (by: string, action: string, detail: unknown) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

const upsertSetting = (key: string, value: string, by: string) => ({
  text: `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
  params: [key, value, by],
});

/** Records an uploaded logo (already stored in R2) and makes it the active one. */
export async function addLogo(
  args: { hash: string; width: number; height: number; label: string; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (!isImageHash(args.hash)) return { ok: false, error: 'That is not a valid image.' };
  try {
    await db.transaction([
      {
        text: `INSERT INTO site_images (hash, content_type, width, height, label, uploaded_by)
               VALUES ($1, 'image/png', $2, $3, $4, $5) ON CONFLICT (hash) DO NOTHING`,
        params: [args.hash, args.width, args.height, args.label.slice(0, 80), args.by],
      },
      upsertSetting('logo', args.hash, args.by),
      audit(args.by, 'logo-upload', { hash: args.hash }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[appearance] addLogo failed:', err);
    return { ok: false, error: 'Could not save that logo. Try again.' };
  }
}

/** `hash` null goes back to the logo shipped in code. */
export async function setActiveLogo(hash: unknown, by: string, db: Db = getDb()): Promise<Result> {
  try {
    if (hash === null) {
      await db.transaction([
        { text: "DELETE FROM site_settings WHERE key = 'logo'" },
        audit(by, 'logo-select', { hash: null }),
      ]);
      return { ok: true };
    }
    if (!isImageHash(hash)) return { ok: false, error: 'That is not a valid image.' };
    const known = await db.query('SELECT 1 FROM site_images WHERE hash = $1', [hash]);
    if (known.length === 0) return { ok: false, error: 'That logo no longer exists.' };
    await db.transaction([upsertSetting('logo', hash, by), audit(by, 'logo-select', { hash })]);
    return { ok: true };
  } catch (err) {
    console.error('[appearance] setActiveLogo failed:', err);
    return { ok: false, error: 'Could not change the logo. Try again.' };
  }
}

/** Removes the row; the caller deletes the R2 object after a successful result. The active logo cannot be deleted. */
export async function removeLogo(hash: unknown, by: string, db: Db = getDb()): Promise<Result> {
  if (!isImageHash(hash)) return { ok: false, error: 'That is not a valid image.' };
  try {
    const active = await db.query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'logo'");
    if (active[0]?.value === hash) return { ok: false, error: 'Pick a different logo first, then delete this one.' };
    await db.transaction([
      { text: 'DELETE FROM site_images WHERE hash = $1', params: [hash] },
      audit(by, 'logo-delete', { hash }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[appearance] removeLogo failed:', err);
    return { ok: false, error: 'Could not delete that logo.' };
  }
}

/** `colour` null goes back to the default gradient. */
export async function setHeroColour(colour: unknown, by: string, db: Db = getDb()): Promise<Result> {
  try {
    if (colour === null) {
      await db.transaction([
        { text: "DELETE FROM site_settings WHERE key = 'hero_colour'" },
        audit(by, 'colour', { colour: null }),
      ]);
      return { ok: true };
    }
    const hex = normaliseHex(colour);
    if (!hex) return { ok: false, error: 'That is not a valid colour.' };
    await db.transaction([upsertSetting('hero_colour', hex, by), audit(by, 'colour', { colour: hex })]);
    return { ok: true };
  } catch (err) {
    console.error('[appearance] setHeroColour failed:', err);
    return { ok: false, error: 'Could not save the colour. Try again.' };
  }
}
