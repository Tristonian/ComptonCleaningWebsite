'use client';

import type { ReactNode } from 'react';
import { useEditMode } from '@/components/EditMode';

/**
 * Shows the Call button during Sam's call hours and the away message outside them (Settings, Calendar).
 * Visitors only ever get one of the two. In pencil mode BOTH are shown, each with a label saying when
 * visitors see it, so the one that is currently hidden can still be tapped and edited. `where` only
 * changes the label wording and spacing.
 */
export function CallSwitch({
  takingCalls,
  call,
  away,
  where,
}: {
  takingCalls: boolean;
  call: ReactNode;
  away: ReactNode;
  where: 'hero' | 'contact';
}) {
  const { editing } = useEditMode();
  if (!editing) return <>{takingCalls ? call : away}</>;

  const tag = (text: string, showingNow: boolean) => (
    <p className={`mx-auto mt-3 w-fit rounded-full px-3 py-1 text-xs font-bold ${showingNow ? 'bg-green-100 text-green-900' : 'bg-white/90 text-ink ring-1 ring-ink/20'}`}>
      {text}
      {showingNow ? ' · showing now' : ''}
    </p>
  );
  return (
    <div className={where === 'hero' ? 'text-ink' : ''}>
      {tag('📞 Shown during your call hours', takingCalls)}
      {call}
      {tag('🌙 Shown out of hours', !takingCalls)}
      {away}
      <p className="mx-auto mt-2 max-w-xs text-center text-xs font-semibold text-ink/70">
        Visitors only see one of these. Change the hours in Admin → Settings.
      </p>
    </div>
  );
}
