import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { TEMPLATE_DEFAULTS, TEMPLATE_DEFS, type TemplateDef } from '@/lib/message-templates';

/**
 * Sam's edits to the texts and emails. A row exists only where he changed something: a NULL subject
 * or body means "still the default", so no override can freeze a default in place. Saving wording
 * identical to the default (and switched on) deletes the row. Audit rows hold the key only.
 */

export type Result = { ok: true } | { ok: false; error: string };
export type ResolvedTemplate = TemplateDef & { enabled: boolean; edited: boolean };

export const MAX_SMS = 1000;
export const MAX_EMAIL = 5000;
export const MAX_SUBJECT = 200;

type Row = { key: string; enabled: boolean; subject: string | null; body: string | null };

function resolve(def: TemplateDef, row?: Row): ResolvedTemplate {
  return {
    ...def,
    subject: row?.subject ?? def.subject,
    body: row?.body ?? def.body,
    enabled: row?.enabled ?? true,
    edited: !!row,
  };
}

/** Every template, in screen order. A database failure returns the defaults, all switched on. */
export async function listTemplates(db: Db = getDb()): Promise<ResolvedTemplate[]> {
  let rows: Row[] = [];
  try {
    rows = await db.query<Row>('SELECT key, enabled, subject, body FROM message_templates');
  } catch (err) {
    console.error('[templates] could not read overrides, using the defaults:', err);
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return TEMPLATE_DEFS.map((d) => resolve(d, byKey.get(d.key)));
}

export async function getTemplate(key: string, db: Db = getDb()): Promise<ResolvedTemplate | null> {
  const def = TEMPLATE_DEFAULTS[key];
  if (!def) return null;
  return (await listTemplates(db)).find((t) => t.key === key) ?? null;
}

const norm = (s: string) => s.replace(/\r\n/g, '\n').trim();

export async function saveTemplate(
  args: { key: unknown; enabled: unknown; subject: unknown; body: unknown; by: string },
  db: Db = getDb(),
): Promise<Result> {
  const def = typeof args.key === 'string' ? TEMPLATE_DEFAULTS[args.key] : undefined;
  if (!def) return { ok: false, error: 'Unknown template.' };
  if (typeof args.body !== 'string') return { ok: false, error: 'Bad request.' };

  const body = norm(args.body);
  const subject = def.kind === 'email' ? norm(typeof args.subject === 'string' ? args.subject : '') : '';
  const enabled = args.enabled !== false;
  if (!body) return { ok: false, error: 'The message cannot be empty. Switch it off instead.' };
  if (body.length > (def.kind === 'sms' ? MAX_SMS : MAX_EMAIL)) return { ok: false, error: 'That is too long.' };
  if (def.kind === 'email') {
    if (!subject) return { ok: false, error: 'An email needs a subject.' };
    if (subject.length > MAX_SUBJECT || /[\r\n]/.test(subject)) return { ok: false, error: 'Keep the subject to one short line.' };
  }

  const subjectOverride = def.kind === 'email' && subject !== def.subject ? subject : null;
  const bodyOverride = body !== norm(def.body) ? body : null;

  try {
    if (enabled && subjectOverride === null && bodyOverride === null) {
      await db.transaction([
        { text: 'DELETE FROM message_templates WHERE key = $1', params: [def.key] },
        { text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', params: [args.by, 'template-reset', JSON.stringify({ key: def.key })] },
      ]);
      return { ok: true };
    }
    await db.transaction([
      {
        text: `INSERT INTO message_templates (key, enabled, subject, body, updated_by) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (key) DO UPDATE SET enabled = $2, subject = $3, body = $4, updated_by = $5, updated_at = now()`,
        params: [def.key, enabled, subjectOverride, bodyOverride, args.by],
      },
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [args.by, 'template-save', JSON.stringify({ key: def.key, enabled })],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[templates] saveTemplate failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Back to the default wording, switched on. */
export async function resetTemplate(args: { key: unknown; by: string }, db: Db = getDb()): Promise<Result> {
  if (typeof args.key !== 'string' || !TEMPLATE_DEFAULTS[args.key]) return { ok: false, error: 'Unknown template.' };
  try {
    await db.transaction([
      { text: 'DELETE FROM message_templates WHERE key = $1', params: [args.key] },
      { text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', params: [args.by, 'template-reset', JSON.stringify({ key: args.key })] },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[templates] resetTemplate failed:', err);
    return { ok: false, error: 'Could not reset that. Try again.' };
  }
}
