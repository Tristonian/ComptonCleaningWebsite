import { describe, expect, it } from 'vitest';
import { assess, centroid, forecastUrl, parseForecast, roundCoord } from './weather';

describe('assess', () => {
  it('is good on a calm dry day', () => {
    expect(assess({ rainChance: 5, gustMph: 10, tempMinC: 8 })).toEqual({ verdict: 'good', note: '' });
  });
  it('is poor when rain is likely', () => {
    expect(assess({ rainChance: 60, gustMph: 10, tempMinC: 8 }).verdict).toBe('poor');
    expect(assess({ rainChance: 59, gustMph: 10, tempMinC: 8 }).verdict).toBe('ok');
    expect(assess({ rainChance: 34, gustMph: 10, tempMinC: 8 }).verdict).toBe('good');
  });
  it('warns about ladders in strong gusts and in a hard frost', () => {
    expect(assess({ rainChance: 0, gustMph: 35, tempMinC: 8 }).verdict).toBe('ladders');
    expect(assess({ rainChance: 0, gustMph: 25, tempMinC: 8 }).verdict).toBe('ok');
    expect(assess({ rainChance: 0, gustMph: 5, tempMinC: 0 }).verdict).toBe('ladders');
    expect(assess({ rainChance: 0, gustMph: 5, tempMinC: 2 }).verdict).toBe('ok');
  });
  it('keeps the worst verdict and every reason', () => {
    const r = assess({ rainChance: 80, gustMph: 40, tempMinC: -1 });
    expect(r.verdict).toBe('ladders');
    expect(r.note).toContain('no ladders');
    expect(r.note).toContain('Rain likely');
    expect(r.note).toContain('Freezing');
  });
  it('treats missing numbers as no warning', () => {
    expect(assess({ rainChance: null, gustMph: null, tempMinC: null }).verdict).toBe('good');
  });
});

describe('parseForecast', () => {
  const payload = {
    daily: {
      time: ['2026-10-04', '2026-10-05'],
      precipitation_probability_max: [70, 10],
      wind_gusts_10m_max: [20, 40],
      temperature_2m_min: [9, 1],
      temperature_2m_max: [14, 12],
    },
  };
  it('zips the columns into days with verdicts', () => {
    const days = parseForecast(payload)!;
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: '2026-10-04', rainChance: 70, verdict: 'poor' });
    expect(days[1]).toMatchObject({ date: '2026-10-05', gustMph: 40, verdict: 'ladders' });
  });
  it('returns null for junk', () => {
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({})).toBeNull();
    expect(parseForecast({ daily: { time: 'x' } })).toBeNull();
    expect(parseForecast({ daily: { time: ['nope'] } })).toBeNull();
  });
  it('tolerates missing or non-numeric columns', () => {
    const days = parseForecast({ daily: { time: ['2026-10-04'], precipitation_probability_max: [null] } })!;
    expect(days[0]).toMatchObject({ rainChance: null, gustMph: null, verdict: 'good' });
  });
});

describe('helpers', () => {
  it('centroid ignores customers without a pin', () => {
    expect(centroid([{ lat: null, lng: null }])).toBeNull();
    expect(centroid([{ lat: 51, lng: -2 }, { lat: 53, lng: -4 }, { lat: null, lng: null }])).toEqual({ lat: 52, lng: -3 });
  });
  it('numbers weekdays Monday 1 to Sunday 7', async () => {
    const { isoWeekday } = await import('./weather');
    expect(isoWeekday('2026-10-05')).toBe(1); // Monday
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
  });
  it('builds a London-time mph url on a 1 km grid', () => {
    const u = new URL(forecastUrl(51.50432, -2.49678));
    expect(u.searchParams.get('latitude')).toBe('51.5');
    expect(u.searchParams.get('longitude')).toBe('-2.5');
    expect(u.searchParams.get('timezone')).toBe('Europe/London');
    expect(u.searchParams.get('wind_speed_unit')).toBe('mph');
    expect(roundCoord(51.504)).toBe(51.5);
  });
});
