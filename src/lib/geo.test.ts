import { describe, expect, it } from 'vitest';
import { isPlausibleUkPoint, mapsLink, parsePoint } from './geo';

describe('parsePoint', () => {
  it('accepts a point in Bristol and rounds to 6 decimals', () => {
    expect(parsePoint('51.5120987654', '-2.5111111111')).toEqual({ lat: 51.512099, lng: -2.511111 });
  });
  it('drops missing, blank, non-numeric and out-of-area values', () => {
    expect(parsePoint(null, null)).toBeNull();
    expect(parsePoint('', '')).toBeNull();
    expect(parsePoint('abc', '-2.5')).toBeNull();
    expect(parsePoint('40.7', '-74')).toBeNull(); // New York
    expect(parsePoint('0', '0')).toBeNull();
    expect(parsePoint('NaN', 'Infinity')).toBeNull();
  });
});

describe('isPlausibleUkPoint', () => {
  it('only takes numbers', () => {
    expect(isPlausibleUkPoint('51.5', '-2.5')).toBe(false);
    expect(isPlausibleUkPoint(51.5, -2.5)).toBe(true);
  });
});

describe('mapsLink', () => {
  it('prefers the confirmed pin', () => {
    const url = mapsLink({ address: '1 High St', postcode: 'BS16 1AA', point: { lat: 51.5, lng: -2.5 } });
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=51.5%2C-2.5');
  });
  it('falls back to the typed address', () => {
    const url = mapsLink({ address: '1 High St', postcode: 'BS16 1AA', point: null });
    expect(url).toContain('query=1%20High%20St%2C%20BS16%201AA');
  });
});
