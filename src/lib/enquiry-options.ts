/**
 * The two drop-downs on the contact form. Values are stable keys stored in the database; labels are
 * for people. Labels live here (not in <Ed> nodes) because an <option> can only hold plain text.
 * Change a label freely; never change a value, or old enquiries lose their meaning.
 */

export interface Option {
  value: string;
  en: string;
  cy: string;
}

/** What they want done. Matches the services on the page. */
export const SERVICES: readonly Option[] = [
  { value: 'window-cleaning', en: 'Window cleaning', cy: 'Glanhau ffenestri' },
  { value: 'gutter-cleaning', en: 'Gutter cleaning', cy: 'Glanhau cwteri' },
  { value: 'gutter-repair', en: 'Gutter repair', cy: 'Trwsio cwteri' },
  { value: 'pressure-washing', en: 'Pressure washing (patios, drives)', cy: 'Golchi dan bwysau (patios, dreifiau)' },
  { value: 'render-cleaning', en: 'Render cleaning', cy: 'Glanhau rendr' },
  { value: 'conservatory', en: 'Conservatory or glass roof', cy: 'Conservatory neu do gwydr' },
  { value: 'other', en: 'Something else', cy: 'Rhywbeth arall' },
];

/** How they found Sam. Optional for the customer. */
export const SOURCES: readonly Option[] = [
  { value: 'google-search', en: 'Google search', cy: 'Chwiliad Google' },
  { value: 'google-maps', en: 'Google Maps', cy: 'Google Maps' },
  { value: 'facebook', en: 'Facebook', cy: 'Facebook' },
  { value: 'instagram', en: 'Instagram', cy: 'Instagram' },
  { value: 'nextdoor', en: 'Nextdoor', cy: 'Nextdoor' },
  { value: 'recommendation', en: 'A friend or neighbour told me', cy: 'Ffrind neu gymydog' },
  { value: 'saw-van-leaflet', en: 'Saw your van, a leaflet or a card', cy: 'Gwelais eich fan, taflen neu gerdyn' },
  { value: 'existing-customer', en: 'I’m already a customer', cy: 'Rwy’n gwsmer yn barod' },
  { value: 'other', en: 'Somewhere else', cy: 'Rhywle arall' },
];

export function isService(v: unknown): v is string {
  return typeof v === 'string' && SERVICES.some((o) => o.value === v);
}

export function isSource(v: unknown): v is string {
  return typeof v === 'string' && SOURCES.some((o) => o.value === v);
}

export function labelOf(list: readonly Option[], value: string, locale: 'en' | 'cy' = 'en'): string {
  const o = list.find((x) => x.value === value);
  return o ? o[locale] : '';
}
