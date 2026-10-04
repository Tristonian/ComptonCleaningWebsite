import { describe, expect, it } from 'vitest';
import { isAllowed, normaliseEmail, parseAllowList } from './allowlist';

describe('normaliseEmail', () => {
  it('lower-cases and trims', () => {
    expect(normaliseEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });
  it('treats googlemail.com as gmail.com', () => {
    expect(normaliseEmail('tristan@googlemail.com')).toBe('tristan@gmail.com');
  });
  it('ignores dots and +tags for gmail only', () => {
    expect(normaliseEmail('Tristan.D.Pointer+shop@gmail.com')).toBe('tristandpointer@gmail.com');
  });
  it('keeps dots and + significant on other domains', () => {
    expect(normaliseEmail('a.b@corp.com')).not.toBe(normaliseEmail('ab@corp.com'));
    expect(normaliseEmail('a+x@corp.com')).toBe('a+x@corp.com');
  });
  it('leaves malformed input alone rather than throwing', () => {
    expect(normaliseEmail('not-an-email')).toBe('not-an-email');
  });
});

describe('isAllowed', () => {
  const list = parseAllowList('samueljcompton93@gmail.com, tristan.d.pointer@googlemail.com');
  it('accepts listed addresses in any equivalent spelling', () => {
    expect(isAllowed('SamuelJCompton93@gmail.com', list)).toBe(true);
    expect(isAllowed('tristandpointer@gmail.com', list)).toBe(true);
  });
  it('rejects everyone else', () => {
    expect(isAllowed('stranger@gmail.com', list)).toBe(false);
  });
  it('rejects empty and missing emails', () => {
    expect(isAllowed('', list)).toBe(false);
    expect(isAllowed(undefined, list)).toBe(false);
    expect(isAllowed(null, list)).toBe(false);
  });
  it('an empty or unset allow-list admits nobody', () => {
    expect(isAllowed('samueljcompton93@gmail.com', parseAllowList(''))).toBe(false);
    expect(isAllowed('samueljcompton93@gmail.com', parseAllowList(undefined))).toBe(false);
  });
});
