import { describe, expect, it } from 'vitest';
import { homeAlternates, isIndexable, jsonLdString, localBusinessJsonLd } from './seo';

describe('seo', () => {
  it('only indexes production', () => {
    expect(isIndexable('production')).toBe(true);
    expect(isIndexable('staging')).toBe(false);
    expect(isIndexable(undefined)).toBe(false);
  });

  it('builds hreflang alternates with an x-default', () => {
    expect(homeAlternates('https://x.test/')).toEqual({
      en: 'https://x.test/',
      cy: 'https://x.test/cy',
      'x-default': 'https://x.test/',
    });
  });

  it('builds LocalBusiness data without invented claims', () => {
    const ld = localBusinessJsonLd({
      origin: 'https://x.test',
      locale: 'en',
      logoUrl: 'https://x.test/l.png',
      serviceNames: ['Window cleaning'],
      description: 'd',
    });
    expect(ld.telephone).toBe('+447756355758');
    expect(ld.makesOffer).toHaveLength(1);
    expect(ld).not.toHaveProperty('aggregateRating');
    expect(ld).not.toHaveProperty('openingHours');
  });

  it('escapes < so a stored string cannot close the script tag', () => {
    expect(jsonLdString({ a: '</script>' })).not.toContain('</script>');
  });
});
