import { describe, expect, it } from 'vitest';
import { SERVICES, SOURCES, isService, isSource, labelOf } from './enquiry-options';

describe('enquiry options', () => {
  it('values are unique, URL-safe keys and every option has both languages', () => {
    for (const list of [SERVICES, SOURCES]) {
      const values = list.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
      for (const o of list) {
        expect(o.value).toMatch(/^[a-z0-9-]+$/);
        expect(o.en.trim()).not.toBe('');
        expect(o.cy.trim()).not.toBe('');
      }
    }
  });
  it('covers the services Sam advertises', () => {
    for (const v of ['window-cleaning', 'gutter-cleaning', 'gutter-repair', 'pressure-washing', 'render-cleaning']) {
      expect(isService(v)).toBe(true);
    }
  });
  it('rejects unknown values and the wrong list', () => {
    expect(isService('nope')).toBe(false);
    expect(isService('google-maps')).toBe(false);
    expect(isSource('window-cleaning')).toBe(false);
    expect(isSource(undefined)).toBe(false);
  });
  it('labelOf gives the label in the right language, or empty', () => {
    expect(labelOf(SERVICES, 'window-cleaning')).toBe('Window cleaning');
    expect(labelOf(SERVICES, 'window-cleaning', 'cy')).toBe('Glanhau ffenestri');
    expect(labelOf(SERVICES, 'nope')).toBe('');
  });
});
