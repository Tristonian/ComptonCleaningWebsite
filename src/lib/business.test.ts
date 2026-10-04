import { describe, expect, it } from 'vitest';
import { formatPence } from './business';

describe('formatPence', () => {
  it('formats whole pounds without decimals', () => {
    expect(formatPence(3000)).toBe('£30');
  });
  it('keeps pence when there are some', () => {
    expect(formatPence(3050)).toBe('£30.50');
  });
});
