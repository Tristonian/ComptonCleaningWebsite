'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPlanStartAction, setPlanStartAction } from '@/app/admin/settings/actions';

/**
 * Where the plan starts, as a small two-way toggle. The preview starts from home (Lyde Green) until
 * "Where I am" is tapped; that asks the phone for its position, which the server keeps for two hours in a
 * cookie (never in the address). "Home" goes back.
 */
export function StartFromHere({ fromHere, since }: { fromHere: boolean; since?: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'denied' | 'failed'>('idle');

  function grab() {
    if (!('geolocation' in navigator)) return setState('failed');
    setState('working');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await setPlanStartAction(pos.coords.latitude, pos.coords.longitude);
          if (!r.ok) return setState('failed');
          setState('idle');
          router.refresh();
        } catch {
          setState('failed');
        }
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function home() {
    await clearPlanStartAction();
    router.refresh();
  }

  const pill = (on: boolean) => `min-h-9 rounded-full px-3 text-xs font-bold ${on ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink/70">Start from</span>
        <button type="button" onClick={home} aria-pressed={!fromHere} className={pill(!fromHere)}>
          🏠 Home
        </button>
        <button type="button" onClick={grab} disabled={state === 'working'} aria-pressed={fromHere} className={`${pill(fromHere)} disabled:opacity-60`}>
          {state === 'working' ? 'Finding you…' : fromHere ? `📍 Where I am${since ? ` (${since})` : ''}` : '📍 Where I am'}
        </button>
      </div>
      <p role="status" className="mt-1 text-xs text-ink/60">
        {state === 'denied' && 'Location is blocked. Allow it for this site in the browser settings.'}
        {state === 'failed' && 'Could not get your location. Try again, or plan from home.'}
        {state === 'idle' && (fromHere ? 'Using your location, forgotten after two hours.' : 'Preview is from home. Tap “Where I am” to start from here.')}
      </p>
    </div>
  );
}
