// Pure parser for the Squeegee customer export (unit tested). The export has these columns:
//   "Cust Ref","Title","First Name","Last Name","Address Line 1","Phone","Mobile","Source","Added"
// It carries no price, frequency, postcode or last-clean date, so an import brings in who and where.
import { normalisePhone } from '@/lib/phone';

export type ImportRow = {
  ref: string;
  name: string;
  address: string;
  phone: string;
  source: string;
  /** ISO date the customer was added in Squeegee, or ''. */
  added: string;
};

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF or LF, and a leading byte-order mark. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** "12/05/24" or "12/05/2024" (day first) -> "2024-05-12"; anything else -> ''. */
export function parseUkDate(raw: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(raw.trim());
  if (!m) return '';
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return '';
  return d.toISOString().slice(0, 10);
}

export type ParsedCsv = { rows: ImportRow[]; problems: string[] };

export function parseCustomersCsv(text: string): ParsedCsv {
  const table = parseCsv(text);
  const problems: string[] = [];
  if (table.length === 0) return { rows: [], problems: ['That file is empty.'] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const need = ['cust ref', 'address line 1'];
  const missing = need.filter((n) => col(n) < 0);
  if (missing.length) {
    return { rows: [], problems: [`This does not look like a Squeegee customer export (no "${missing.join('", "')}" column).`] };
  }
  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const ref = get(r, 'cust ref');
    const address = get(r, 'address line 1');
    if (!ref) return void problems.push(`Line ${line}: no customer reference, skipped.`);
    if (seen.has(ref)) return void problems.push(`Line ${line}: reference ${ref} appears twice, the second is skipped.`);
    seen.add(ref);
    const person = [get(r, 'title'), get(r, 'first name'), get(r, 'last name')].filter(Boolean).join(' ');
    // Some Squeegee customers have only an address. A name is required here, so the address stands in
    // for it until Sam types one; the row says so rather than hiding it.
    const name = person || address;
    if (!name) return void problems.push(`Line ${line}: no name and no address, skipped.`);
    rows.push({
      ref,
      name,
      address,
      phone: normalisePhone(get(r, 'mobile') || get(r, 'phone')),
      source: get(r, 'source'),
      added: parseUkDate(get(r, 'added')),
    });
  });
  return { rows, problems };
}
