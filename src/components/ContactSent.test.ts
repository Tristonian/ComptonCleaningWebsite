import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The pencil's provider talks to the router and server actions; this test only needs the markup.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => '/' }));
vi.mock('@/app/actions', () => ({ saveNodeAction: async () => ({ ok: true }), resetNodeAction: async () => ({ ok: true }) }));

import { EditModeProvider } from './EditMode';
import { ContactSent, type SentSnapshot } from './ContactSent';

const snap: SentSnapshot = {
  name: 'Jo <b>Bloggs</b>',
  service: 'Window cleaning',
  source: 'Google Maps',
  address: '98 Park Road',
  postcode: 'BS16 1AA',
  phone: '07700 900123',
  email: 'jo@example.com',
  notes: 'Side gate\nDog in garden',
  pin: { lat: 51.4847, lng: -2.5519 },
};

function render(snapshot: SentSnapshot | null, token?: string, locale: 'en' | 'cy' = 'en') {
  return renderToStaticMarkup(
    createElement(EditModeProvider, {
      locale,
      overrides: {},
      canEdit: false,
      children: createElement(ContactSent, { snapshot, mapboxToken: token }),
    }),
  );
}

describe('ContactSent', () => {
  it('thanks them and shows back everything they sent', () => {
    const html = render(snap, 'pk.test');
    expect(html).toContain('Thanks, we’ll be in touch soon.');
    expect(html).toContain('Here’s what you sent us');
    for (const bit of ['Window cleaning', 'Google Maps', '98 Park Road', 'BS16 1AA', '07700 900123', 'jo@example.com', 'Side gate', 'Dog in garden']) {
      expect(html).toContain(bit);
    }
  });

  it('shows the confirmed pin on a small map', () => {
    const html = render(snap, 'pk.test');
    expect(html).toContain('api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+085478(-2.5519,51.4847)');
    expect(html).toContain('The pin you confirmed on the map');
  });

  it('leaves out the map when there is no pin or no token, and any empty rows', () => {
    const noPin = render({ ...snap, pin: null, email: '' }, 'pk.test');
    expect(noPin).not.toContain('api.mapbox.com');
    expect(noPin).not.toContain('jo@example.com');
    expect(render(snap, undefined)).not.toContain('api.mapbox.com');
  });

  it('escapes what the customer typed', () => {
    const html = render(snap, 'pk.test');
    expect(html).not.toContain('<b>Bloggs</b>');
    expect(html).toContain('Jo &lt;b&gt;Bloggs&lt;/b&gt;');
  });

  it('still thanks them if there is no snapshot', () => {
    const html = render(null);
    expect(html).toContain('Thanks, we’ll be in touch soon.');
    expect(html).not.toContain('Here’s what you sent us');
  });

  it('speaks Welsh on /cy', () => {
    expect(render(snap, 'pk.test', 'cy')).toContain('Diolch, byddwn mewn cysylltiad cyn bo hir.');
  });
});
