import { describe, expect, it } from 'vitest';
import { formatLondon, timeAgo } from './format';

describe('formatLondon', () => {
  it('shows Europe/London time, including British Summer Time', () => {
    expect(formatLondon(new Date('2026-07-01T11:30:00Z'))).toContain('12:30'); // BST = UTC+1
    expect(formatLondon(new Date('2026-12-01T11:30:00Z'))).toContain('11:30'); // GMT
  });
  it('can leave the time out and copes with strings and nonsense', () => {
    expect(formatLondon('2026-10-04T15:00:00Z', false)).toBe('4 Oct 2026');
    expect(formatLondon('not a date')).toBe('');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('speaks in minutes, hours and days', () => {
    expect(timeAgo(new Date('2026-10-04T11:59:40Z'), now)).toBe('just now');
    expect(timeAgo(new Date('2026-10-04T11:55:00Z'), now)).toBe('5 minutes ago');
    expect(timeAgo(new Date('2026-10-04T11:00:00Z'), now)).toBe('1 hour ago');
    expect(timeAgo(new Date('2026-10-02T12:00:00Z'), now)).toBe('2 days ago');
  });
  it('falls back to a date after a week', () => {
    expect(timeAgo(new Date('2026-09-01T12:00:00Z'), now)).toBe('1 Sept 2026');
  });
});
