import { describe, expect, it } from 'vitest';
import { PLAN_START_MAX_AGE_SECONDS, parsePlanStart, serialisePlanStart } from './plan-start';

const NOW = 1_790_000_000_000;

describe('plan start', () => {
  it('round-trips a UK location', () => {
    const raw = serialisePlanStart(51.5123456, -2.5012345, NOW);
    expect(parsePlanStart(raw, NOW + 1000)).toEqual({ lat: 51.51235, lng: -2.50123, at: NOW });
  });

  it('forgets a location after two hours', () => {
    const raw = serialisePlanStart(51.5, -2.5, NOW);
    expect(parsePlanStart(raw, NOW + PLAN_START_MAX_AGE_SECONDS * 1000 - 1)).not.toBeNull();
    expect(parsePlanStart(raw, NOW + PLAN_START_MAX_AGE_SECONDS * 1000 + 1)).toBeNull();
  });

  it('rejects junk, missing values, places outside the UK and timestamps from the future', () => {
    expect(parsePlanStart(undefined, NOW)).toBeNull();
    expect(parsePlanStart('', NOW)).toBeNull();
    expect(parsePlanStart('hello', NOW)).toBeNull();
    expect(parsePlanStart(`40.71280,-74.00600,${NOW}`, NOW)).toBeNull(); // New York
    expect(parsePlanStart(`51.50000,-2.50000,${NOW + 10 * 60_000}`, NOW)).toBeNull();
    expect(parsePlanStart('51.5,-2.5,abc', NOW)).toBeNull();
  });
});
