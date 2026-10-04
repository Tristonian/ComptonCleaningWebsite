'use client';

import { useState } from 'react';
import { parseCustomersCsv, type ParsedCsv } from '@/lib/customers-csv';
import { importCustomersAction } from '@/app/admin/customers/actions';

/** Pick the Squeegee export, see what it contains, then import. Safe to run again: nothing already here is overwritten. */
export function CustomerImport() {
  const [csv, setCsv] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onFile(file: File | undefined) {
    setResult(null);
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setParsed(parseCustomersCsv(text));
  }

  async function go() {
    setBusy(true);
    try {
      setResult(await importCustomersAction(csv));
    } catch {
      setResult({ ok: false, message: 'Something went wrong. Nothing was changed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block text-sm font-semibold text-ink/80">
        Squeegee customer export (.csv)
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="mt-1 block w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal"
        />
      </label>

      {parsed && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/10">
          <p className="font-bold text-brand-deep">
            {parsed.rows.length} customer{parsed.rows.length === 1 ? '' : 's'} found
          </p>
          <ul className="mt-2 divide-y divide-ink/10 text-sm">
            {parsed.rows.slice(0, 5).map((r) => (
              <li key={r.ref} className="py-1.5">
                <span className="font-semibold">{r.name}</span>
                <span className="text-ink/70">
                  {r.address && r.address !== r.name ? ` · ${r.address}` : ''}
                  {r.phone ? ` · ${r.phone}` : ' · no phone'}
                </span>
              </li>
            ))}
          </ul>
          {parsed.rows.length > 5 && <p className="mt-1 text-xs text-ink/60">…and {parsed.rows.length - 5} more.</p>}
          {parsed.problems.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-900">
              {parsed.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink/60">
            The export has names, addresses and phone numbers only. Price, how often, and rounds are set afterwards.
          </p>
        </div>
      )}

      {parsed && parsed.rows.length > 0 && !result?.ok && (
        <button type="button" onClick={go} disabled={busy} className="rounded-xl bg-brand-deep px-4 py-4 text-lg font-black text-white disabled:opacity-60">
          {busy ? 'Importing…' : `Import ${parsed.rows.length}`}
        </button>
      )}

      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-sm font-semibold ${result.ok ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-800'}`}>
          {result.message} {result.ok && <a href="/admin/customers" className="underline">See customers</a>}
        </p>
      )}
    </div>
  );
}
