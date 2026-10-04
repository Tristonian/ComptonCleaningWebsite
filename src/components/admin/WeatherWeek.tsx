import { VERDICT_TEXT, type Day, type Verdict } from '@/lib/weather';

const dot: Record<Verdict, string> = { good: 'bg-green-600', ok: 'bg-yellow-500', poor: 'bg-orange-600', ladders: 'bg-red-700' };
const banner: Record<Verdict, string> = {
  good: 'bg-green-50 text-green-900',
  ok: 'bg-yellow-50 text-yellow-900',
  poor: 'bg-orange-50 text-orange-900',
  ladders: 'bg-red-50 text-red-900',
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

/** The week at a glance: a plain line for today, then one small column per day. Server-rendered, no script. */
export function WeatherWeek({ title, days, today, highlight }: { title: string; days: Day[]; today: string; highlight?: string }) {
  const current = days.find((d) => d.date === today) ?? days[0];
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink/60">{title}</h2>
      <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${banner[current.verdict]}`}>
        Today: {VERDICT_TEXT[current.verdict]}
        {current.note && <span className="block font-normal">{current.note}.</span>}
      </p>
      <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((d) => (
          <li key={d.date} className={`rounded-lg p-1 ${d.date === highlight ? 'ring-2 ring-brand-deep' : 'ring-1 ring-ink/10'}`} title={d.note || VERDICT_TEXT[d.verdict]}>
            <span className="block font-bold">{d.date === today ? 'Today' : weekday(d.date)}</span>
            <span aria-hidden className={`mx-auto my-1 block h-2.5 w-2.5 rounded-full ${dot[d.verdict]}`} />
            <span className="block">{d.rainChance === null ? '–' : `${Math.round(d.rainChance)}%`}</span>
            <span className="block text-ink/70">{d.gustMph === null ? '–' : `${Math.round(d.gustMph)}mph`}</span>
            <span className="block text-ink/70">{d.tempMinC === null ? '–' : `${Math.round(d.tempMinC)}°`}</span>
            <span className="sr-only">{VERDICT_TEXT[d.verdict]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink/60">Rain chance, top gust, overnight low. Weather by Open-Meteo.</p>
    </section>
  );
}
