// Every text and email Sam sends from the admin. Defaults live here; the Templates screen lets him
// switch each off and edit it, overrides-only like page content (see templates.ts for the store).
// Tokens are {first_name} (texts) and {name} (replies to an enquiry).

import { REPLY_TEMPLATES, tidyName } from '@/lib/reply-templates';

export type TemplateKind = 'sms' | 'email';

export interface TemplateDef {
  key: string;
  kind: TemplateKind;
  label: string;
  /** One line on the Templates screen saying when it is used. */
  hint: string;
  /** Emails only. */
  subject: string;
  body: string;
  tokens: readonly string[];
}

export const COMING_TOMORROW = 'coming_tomorrow';
export const replyKey = (id: string) => `reply_${id}`;

export const TEMPLATE_DEFS: readonly TemplateDef[] = [
  {
    key: COMING_TOMORROW,
    kind: 'sms',
    label: 'Coming tomorrow',
    hint: 'The text from the customer list. Switch it off and the button disappears.',
    subject: '',
    body: "Hi {first_name}, it's Sam from Compton Cleaning. I'm planning to do your windows tomorrow. No need to be in, just make sure I can get to the windows. Shout if that's not OK. Thanks!",
    tokens: ['{first_name}'],
  },
  ...REPLY_TEMPLATES.map(
    (t): TemplateDef => ({
      key: replyKey(t.id),
      kind: 'email',
      label: t.label,
      hint: 'A starting point when you reply to an enquiry. You can still edit it before sending.',
      subject: t.subject,
      body: t.body,
      tokens: ['{name}'],
    }),
  ),
];

export const TEMPLATE_DEFAULTS: Record<string, TemplateDef> = Object.fromEntries(TEMPLATE_DEFS.map((d) => [d.key, d]));

/** "Mrs Ann Example" -> "Ann"; falls back to a friendly "there" when there is no usable name. */
export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(p));
  const first = tidyName(parts[0] ?? '');
  // An address stands in for a name when Squeegee had none ("17 Sample Parade"): do not greet a house number.
  return first && !/\d/.test(first) ? first : 'there';
}

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
