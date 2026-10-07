'use client';

import { useState } from 'react';
import { buildRoundAction } from '@/app/admin/settings/actions';

export type DueCustomer = { id: string; name: string; address: string; due: string; overdue: boolean; rounds: string[]; hasPin: boolean };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Build a round on the fly from the customers who are due: everyone starts ticked, untick who you are not
 * doing, name it, and Build. The new round opens straight on its best-order preview. The tick boxes are
 * ordinary form fields, so this still works if the page's script has not loaded yet.
 */
export function BuildRound({ customers, defaultName }: { customers: DueCustomer[]; defaultName: string }) {
  const [ticked, setTicked] = useState(() => new Set(customers.map((c) => c.id)));
  const toggle = (id: string) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (customers.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-ink/70 ring-1 ring-ink/10">Nobody is due this week, so there is nothing to build a round from yet.</p>;
  }
  return (
    <form action={buildRoundAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink/80">
          {ticked.size} of {customers.length} ticked
        </span>
        <button type="button" onClick={() => setTicked(new Set(customers.map((c) => c.id)))} className="min-h-9 rounded-full px-3 text-xs font-bold text-brand-deep ring-1 ring-brand-deep/40">
          Tick all
        </button>
        <button type="button" onClick={() => setTicked(new Set())} className="min-h-9 rounded-full px-3 text-xs font-bold text-brand-deep ring-1 ring-brand-deep/40">
          Tick none
        </button>
      </div>

      <ul className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto rounded-xl bg-paper p-1.5 ring-1 ring-ink/10">
        {customers.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-ink/10">
              <input type="checkbox" checked={ticked.has(c.id)} onChange={() => toggle(c.id)} className="h-6 w-6 shrink-0" />
              {ticked.has(c.id) && <input type="hidden" name="ids" value={c.id} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{c.address || c.name}</span>
                <span className="block truncate text-xs text-ink/70">
                  {c.address ? `${c.name} · ` : ''}
                  <span className={c.overdue ? 'font-bold text-amber-800' : ''}>{c.overdue ? 'Overdue, was due' : 'Due'} {c.due}</span>
                  {c.rounds.length > 0 && ` · in ${c.rounds.join(', ')}`}
                  {!c.hasPin && ' · no pin yet'}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="text-sm font-semibold text-ink/80">
          Name for the round
          <input name="name" required defaultValue={defaultName} maxLength={60} className="mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal" />
        </label>
        <label className="text-sm font-semibold text-ink/80">
          Day
          <select name="weekday" defaultValue="" className="mt-1 block rounded-xl border border-ink/20 bg-white p-3 text-base font-normal">
            <option value="">Any</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" disabled={ticked.size === 0} className="min-h-12 rounded-xl bg-brand-deep px-4 text-lg font-black text-white disabled:opacity-40">
        Build the round and find its best order
      </button>
      <p className="text-xs text-ink/70">Customers stay in any rounds they are already in. You can delete a one-off round afterwards from its page.</p>
    </form>
  );
}
