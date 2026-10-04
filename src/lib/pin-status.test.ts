import { describe, expect, it } from 'vitest';
import { PIN_STATUSES, pinStatus } from './pin-status';

const TODAY = '2026-10-07';
const WEEK_END = '2026-10-11';

describe('pin colours', () => {
  it('money owed wins over everything', () => {
    expect(pinStatus({ owingPence: 1500, nextDue: '2026-09-01' }, TODAY, WEEK_END)).toBe('owing');
    expect(pinStatus({ owingPence: 1, nextDue: null }, TODAY, WEEK_END)).toBe('owing');
  });
  it('then overdue, due this week, up to date', () => {
    expect(pinStatus({ owingPence: 0, nextDue: '2026-10-06' }, TODAY, WEEK_END)).toBe('overdue');
    expect(pinStatus({ owingPence: 0, nextDue: TODAY }, TODAY, WEEK_END)).toBe('due');
    expect(pinStatus({ owingPence: 0, nextDue: WEEK_END }, TODAY, WEEK_END)).toBe('due');
    expect(pinStatus({ owingPence: 0, nextDue: '2026-10-12' }, TODAY, WEEK_END)).toBe('ok');
  });
  it('a customer with no frequency is grey', () => {
    expect(pinStatus({ owingPence: 0, nextDue: null }, TODAY, WEEK_END)).toBe('none');
  });
  it('every status has a distinct colour for the key', () => {
    expect(new Set(PIN_STATUSES.map((p) => p.colour)).size).toBe(PIN_STATUSES.length);
  });
});
