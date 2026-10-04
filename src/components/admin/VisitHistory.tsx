import type { JobRow } from '@/lib/jobs';
import { DeleteVisitForm, MarkPaidForm, VisitForm } from '@/components/admin/VisitForm';

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type Method = { key: string; label: string };

/**
 * A customer's visits and payments, newest first. Each can be edited (date, price, payment, extras,
 * notes: never a future date) or deleted. Unpaid visits say so and carry a Mark paid button.
 */
export function VisitHistory({
  customerId,
  jobs,
  methods,
  today,
  back,
  preferredPayment,
}: {
  customerId: string;
  jobs: JobRow[];
  methods: Method[];
  today: string;
  back: string;
  preferredPayment: string;
}) {
  const label = (key: string) => methods.find((m) => m.key === key)?.label ?? key;
  const paidTotal = jobs.filter((j) => j.status === 'done' && j.paid).reduce((s, j) => s + j.totalPence, 0);
  const owing = jobs.filter((j) => j.status === 'done' && !j.paid).reduce((s, j) => s + j.totalPence, 0);

  if (jobs.length === 0) return <p className="rounded-xl bg-white p-4 text-sm text-ink/70 ring-1 ring-ink/10">No visits logged yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink/80">
        {jobs.length} visit{jobs.length === 1 ? '' : 's'} · paid {pounds(paidTotal)}
        {owing > 0 && <strong className="text-red-700"> · owes {pounds(owing)}</strong>}
      </p>
      <ul className="flex flex-col gap-2">
        {jobs.map((j) => (
          <li key={j.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-bold">{day(j.doneOn)}</span>
              {j.status === 'missed' ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Missed</span>
              ) : (
                <span className="font-black text-brand-deep">{pounds(j.totalPence)}</span>
              )}
            </div>
            {j.status === 'done' && (
              <p className="mt-0.5 text-sm text-ink/80">
                {j.paid ? `Paid by ${label(j.paymentMethod)}` : <strong className="text-red-700">Not paid</strong>}
                {j.extras.length > 0 && ` · includes ${j.extras.map((e) => `${e.label} ${pounds(e.pricePence)}`).join(', ')}`}
              </p>
            )}
            {j.notes && <p className="mt-0.5 whitespace-pre-line text-sm text-ink/70">{j.notes}</p>}
            {j.status === 'done' && !j.paid && (
              <div className="mt-2">
                <MarkPaidForm jobId={j.id} methods={methods} back={back} preferred={preferredPayment} />
              </div>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-brand-deep">Edit or delete</summary>
              <div className="mt-3 flex flex-col gap-3">
                <VisitForm customerId={customerId} job={j} methods={methods} today={today} back={back} />
                <DeleteVisitForm jobId={j.id} back={back} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
