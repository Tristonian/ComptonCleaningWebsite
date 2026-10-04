// The texts Sam sends from the customer list. Defaults live here; the Templates screen (next) will let
// him switch them off and edit them, overrides-only like page content. Tokens are {first_name} etc.

import { tidyName } from '@/lib/reply-templates';

export type TemplateKey = 'coming_tomorrow';

export const TEMPLATE_DEFAULTS: Record<TemplateKey, { label: string; body: string }> = {
  coming_tomorrow: {
    label: 'Coming tomorrow',
    body: "Hi {first_name}, it's Sam from Compton Cleaning. I'm planning to do your windows tomorrow. No need to be in, just make sure I can get to the windows. Shout if that's not OK. Thanks!",
  },
};

/** "Mrs Ann Example" -> "Ann"; falls back to a friendly "there" when there is no usable name. */
export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(p));
  const first = parts[0] ?? '';
  // An address stands in for a name when Squeegee had none ("17 Sample Parade"): do not greet a house number.
  return first && !/\d/.test(first) ? first : 'there';
}

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
