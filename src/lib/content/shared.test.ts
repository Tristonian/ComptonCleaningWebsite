import { describe, expect, it } from 'vitest';
import { checkValue, isValidNodeKey, localeFromPath, switchLocalePath } from './shared';

describe('isValidNodeKey', () => {
  it('accepts dotted lower-case ids', () => {
    for (const k of ['home.hero.title', 'nav.call', 'a1', 'price-4-weekly.label']) {
      expect(isValidNodeKey(k)).toBe(true);
    }
  });
  it('rejects everything else', () => {
    for (const k of ['', 'Home.Hero', 'has space', '.lead', 'trail.', '../x', 'a/b', 'x'.repeat(81), 5, null]) {
      expect(isValidNodeKey(k)).toBe(false);
    }
  });
});

describe('checkValue', () => {
  it('trims and accepts normal text, including newlines and Welsh characters', () => {
    expect(checkValue('  Glanhau ffenestri ŵ ŷ â  ')).toEqual({ ok: true, value: 'Glanhau ffenestri ŵ ŷ â' });
    expect(checkValue('line one\nline two').ok).toBe(true);
  });
  it('rejects empty, huge and control-character values', () => {
    expect(checkValue('').ok).toBe(false);
    expect(checkValue('x'.repeat(2001)).ok).toBe(false);
    expect(checkValue('a\u0000b').ok).toBe(false);
    expect(checkValue(undefined).ok).toBe(false);
  });
});

describe('locale paths', () => {
  it('detects Welsh paths without matching lookalikes', () => {
    expect(localeFromPath('/cy')).toBe('cy');
    expect(localeFromPath('/cy/prices')).toBe('cy');
    expect(localeFromPath('/')).toBe('en');
    expect(localeFromPath('/cymru')).toBe('en');
    expect(localeFromPath('/cyan')).toBe('en');
  });
  it('switches between languages and back', () => {
    expect(switchLocalePath('/', 'cy')).toBe('/cy');
    expect(switchLocalePath('/prices', 'cy')).toBe('/cy/prices');
    expect(switchLocalePath('/cy', 'en')).toBe('/');
    expect(switchLocalePath('/cy/prices', 'en')).toBe('/prices');
    expect(switchLocalePath('/cymru', 'cy')).toBe('/cy/cymru');
  });
});
