import { formatPhone, type EnquiryInput } from './enquiry';
import { SERVICES, SOURCES, labelOf } from './enquiry-options';

export type PinKind = 'pin' | 'postcode' | 'none';

const PIN_LABEL: Record<PinKind, string> = {
  pin: 'Pin confirmed by the customer',
  postcode: 'Approximate: the centre of their postcode, no pin placed',
  none: 'No pin: address search only',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The notification Sam receives. Pure, so the wording, escaping and links are unit tested. The map
 * picture is an inline attachment (`cid:map`), added by the caller when it could be fetched.
 */
export function buildEnquiryEmail(args: {
  input: EnquiryInput;
  mapUrl: string;
  directionsUrl: string;
  pinKind: PinKind;
  hasMapImage: boolean;
}): { subject: string; text: string; html: string } {
  const { input, mapUrl, directionsUrl, pinKind, hasMapImage } = args;
  const pinText = PIN_LABEL[pinKind];
  const service = labelOf(SERVICES, input.service);
  const source = labelOf(SOURCES, input.source);

  const notesText = input.notes ? `\nNotes:\n${input.notes}\n` : '';
  const text =
    `Name: ${input.name}\nService: ${service}\n` +
    (source ? `Heard about us: ${source}\n` : '') +
    `Address: ${input.address}\nPostcode: ${input.postcode}\n` +
    (input.phone ? `Phone: ${formatPhone(input.phone)} (tap to call: tel:${input.phone})\n` : '') +
    (input.email ? `Email: ${input.email}\n` : '') +
    `\n${pinText}\nOpen in Google Maps: ${mapUrl}\nDirections: ${directionsUrl}\n${notesText}\nSent from the website contact form.`;

  const button = (href: string, label: string, solid: boolean) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:14px 22px;border-radius:10px;font:bold 16px Arial,sans-serif;text-decoration:none;${
      solid ? 'background:#085478;color:#ffffff;' : 'border:2px solid #085478;color:#085478;'
    }">${label}</a>`;

  const html =
    `<div style="font:16px/1.5 Arial,sans-serif;color:#0f2131;max-width:640px">` +
    `<p><b>Name:</b> ${esc(input.name)}<br><b>Wants:</b> ${esc(service)}` +
    (source ? `<br><b>Heard about us:</b> ${esc(source)}` : '') +
    `<br><b>Address:</b> ${esc(input.address)}<br>` +
    `<b>Postcode:</b> ${esc(input.postcode)}` +
    (input.phone ? `<br><b>Phone:</b> <a href="tel:${input.phone}">${esc(formatPhone(input.phone))}</a>` : '') +
    (input.email ? `<br><b>Email:</b> <a href="mailto:${esc(input.email)}">${esc(input.email)}</a>` : '') +
    `</p>` +
    (hasMapImage
      ? `<p style="margin:0 0 4px"><a href="${mapUrl}"><img src="cid:map" alt="Map of the customer's location" width="600" style="width:100%;max-width:600px;border-radius:10px;border:1px solid #cfd8dc"></a></p>`
      : '') +
    `<p style="margin:0 0 12px;font-size:14px;color:#455a64">${esc(pinText)}</p>` +
    `<p>${button(mapUrl, 'Open in Google Maps', true)}${button(directionsUrl, 'Get directions', false)}</p>` +
    (input.notes ? `<p><b>Notes:</b><br>${esc(input.notes).replace(/\n/g, '<br>')}</p>` : '') +
    `<p style="font-size:14px;color:#455a64">Sent from the website contact form.</p></div>`;

  return { subject: `New enquiry from ${input.name}`, text, html };
}
