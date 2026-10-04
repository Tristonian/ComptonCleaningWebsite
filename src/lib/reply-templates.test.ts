import { describe, expect, it } from 'vitest';
import { REPLY_TEMPLATES, fillTemplate, findTemplate, firstName } from './reply-templates';

describe('reply templates', () => {
  it('have unique ids, a label, a subject and a body that greets by name', () => {
    expect(new Set(REPLY_TEMPLATES.map((t) => t.id)).size).toBe(REPLY_TEMPLATES.length);
    for (const t of REPLY_TEMPLATES) {
      expect(t.label && t.subject && t.body).toBeTruthy();
      expect(t.body).toContain('{name}');
    }
  });
  it('make no insurance or cover claims', () => {
    for (const t of REPLY_TEMPLATES) expect(t.body.toLowerCase()).not.toMatch(/insured|insurance|public liability|fully covered/);
  });
  it('the quote uses the price from business.ts', () => {
    expect(findTemplate('quote')?.body).toContain('£30');
  });
  it('firstName takes the first word and never returns empty', () => {
    expect(firstName('Jo Bloggs')).toBe('Jo');
    expect(firstName('  ')).toBe('there');
  });
  it('fillTemplate replaces every {name}', () => {
    const out = fillTemplate('Hi {name}, {name}!', 'Jo Bloggs');
    expect(out).toBe('Hi Jo, Jo!');
    expect(fillTemplate(findTemplate('thanks')!.body, '')).toContain('Hi there,');
  });
});
