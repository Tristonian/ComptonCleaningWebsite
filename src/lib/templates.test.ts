import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { TEMPLATE_DEFAULTS } from './message-templates';
import { getTemplate, listTemplates, resetTemplate, saveTemplate } from './templates';

let db: Db;
beforeEach(async () => {
  ({ db } = await makeTestDb());
});

const sms = TEMPLATE_DEFAULTS.coming_tomorrow;
const email = TEMPLATE_DEFAULTS.reply_thanks;

describe('templates', () => {
  it('lists every template at its default, switched on, until Sam changes one', async () => {
    const all = await listTemplates(db);
    expect(all.length).toBeGreaterThanOrEqual(5);
    expect(all.every((t) => t.enabled && !t.edited)).toBe(true);
    expect(all.find((t) => t.key === 'coming_tomorrow')?.body).toBe(sms.body);
  });

  it('saves edited wording and keeps the other field on its default', async () => {
    const r = await saveTemplate({ key: email.key, enabled: true, subject: email.subject, body: 'Hi {name}, hello.', by: 's' }, db);
    expect(r.ok).toBe(true);
    const t = await getTemplate(email.key, db);
    expect(t).toMatchObject({ body: 'Hi {name}, hello.', subject: email.subject, edited: true, enabled: true });
    const rows = await db.query<{ subject: string | null }>('SELECT subject FROM message_templates WHERE key = $1', [email.key]);
    expect(rows[0].subject).toBeNull();
  });

  it('switching off keeps the default wording, and saving the default back removes the row', async () => {
    await saveTemplate({ key: sms.key, enabled: false, subject: '', body: sms.body, by: 's' }, db);
    expect(await getTemplate(sms.key, db)).toMatchObject({ enabled: false, body: sms.body, edited: true });
    await saveTemplate({ key: sms.key, enabled: true, subject: '', body: sms.body, by: 's' }, db);
    expect(await db.query('SELECT 1 FROM message_templates')).toHaveLength(0);
  });

  it('reset deletes the override', async () => {
    await saveTemplate({ key: sms.key, enabled: true, subject: '', body: 'Changed', by: 's' }, db);
    expect((await resetTemplate({ key: sms.key, by: 's' }, db)).ok).toBe(true);
    expect(await getTemplate(sms.key, db)).toMatchObject({ body: sms.body, edited: false });
  });

  it('refuses unknown keys, empty or overlong text, and a missing or multi-line subject', async () => {
    expect((await saveTemplate({ key: 'nope', enabled: true, subject: '', body: 'x', by: 's' }, db)).ok).toBe(false);
    expect((await saveTemplate({ key: sms.key, enabled: true, subject: '', body: '  ', by: 's' }, db)).ok).toBe(false);
    expect((await saveTemplate({ key: sms.key, enabled: true, subject: '', body: 'x'.repeat(1001), by: 's' }, db)).ok).toBe(false);
    expect((await saveTemplate({ key: email.key, enabled: true, subject: '', body: 'x', by: 's' }, db)).ok).toBe(false);
    expect((await saveTemplate({ key: email.key, enabled: true, subject: 'a\nb', body: 'x', by: 's' }, db)).ok).toBe(false);
    expect((await resetTemplate({ key: 'nope', by: 's' }, db)).ok).toBe(false);
  });

  it('audit rows hold the key only', async () => {
    await saveTemplate({ key: email.key, enabled: true, subject: 'Private subject', body: 'Private body', by: 's' }, db);
    const log = await db.query<{ detail: string }>("SELECT detail FROM audit_log WHERE action = 'template-save'");
    expect(log[0].detail).not.toMatch(/Private/);
  });
});
