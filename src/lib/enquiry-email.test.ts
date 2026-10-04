import { describe, expect, it } from 'vitest';
import { checkEnquiry } from './enquiry';
import { buildEnquiryEmail } from './enquiry-email';

const checked = checkEnquiry({
  name: 'Jo <b>Bloggs</b>',
  address: '1 High St',
  postcode: 'bs161aa',
  phone: '07700 900123',
  email: 'jo@example.com',
  service: 'window-cleaning',
  source: 'google-maps',
  notes: 'Side gate\nDog "Rex"',
  lat: '51.5121',
  lng: '-2.5111',
});
if (!checked.ok) throw new Error('fixture invalid');
const base = {
  input: checked.value,
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=51.5121%2C-2.5111',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=51.5121%2C-2.5111',
};

describe('buildEnquiryEmail', () => {
  it('has the map image, both one-tap links and the pin status', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'pin', hasMapImage: true });
    expect(e.html).toContain('src="cid:map"');
    expect(e.html).toContain(`href="${base.mapUrl}"`);
    expect(e.html).toContain(`href="${base.directionsUrl}"`);
    expect(e.html).toContain('Pin confirmed by the customer');
    expect(e.text).toContain(base.mapUrl);
    expect(e.text).toContain(base.directionsUrl);
  });

  it('shows the phone and email as tap-to-call and tap-to-write links', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'pin', hasMapImage: true });
    expect(e.html).toContain('href="tel:+447700900123"');
    expect(e.html).toContain('07700 900123');
    expect(e.html).toContain('href="mailto:jo@example.com"');
    expect(e.text).toContain('Phone: 07700 900123');
    expect(e.text).toContain('Email: jo@example.com');
  });

  it('says what they want and where they heard about us', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'pin', hasMapImage: true });
    expect(e.html).toContain('<b>Wants:</b> Window cleaning');
    expect(e.html).toContain('<b>Heard about us:</b> Google Maps');
    expect(e.text).toContain('Service: Window cleaning');
    expect(e.text).toContain('Heard about us: Google Maps');
  });

  it('leaves out whichever of phone and email was not given', () => {
    const only = checkEnquiry({ name: 'Jo', address: 'a', postcode: 'bs161aa', phone: '07700 900123', service: 'other' });
    if (!only.ok) throw new Error('fixture');
    const e = buildEnquiryEmail({ ...base, input: only.value, pinKind: 'none', hasMapImage: false });
    expect(e.html).not.toContain('Email:');
    expect(e.html).toContain('Phone:');
  });

  it('leaves the image out when it could not be fetched, but keeps the links', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'none', hasMapImage: false });
    expect(e.html).not.toContain('cid:map');
    expect(e.html).toContain('Open in Google Maps');
    expect(e.html).toContain('No pin: address search only');
  });

  it('says plainly when the map is only the postcode centre', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'postcode', hasMapImage: true });
    expect(e.html).toContain('Approximate: the centre of their postcode');
  });

  it('escapes customer text in the HTML and keeps notes line breaks', () => {
    const e = buildEnquiryEmail({ ...base, pinKind: 'pin', hasMapImage: true });
    expect(e.html).not.toContain('<b>Bloggs</b>');
    expect(e.html).toContain('&#60;b&#62;Bloggs');
    expect(e.html).toContain('Side gate<br>Dog &#34;Rex&#34;');
    expect(e.subject).toBe('New enquiry from Jo <b>Bloggs</b>');
  });
});
