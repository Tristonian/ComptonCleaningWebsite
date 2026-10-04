import type { JobRow } from '@/lib/jobs';
import { deleteVisitAction, markPaidAction, recordVisitAction, updateVisitAction } from '@/app/admin/visit-actions';

/**
 * The DONE panel (ADR 0008): opens with the customer's usual price and payment method filled in, all
 * editable. Plain server markup, no client JS: it works on a bad connection and costs nothing to load.
 * With `job` it edits an earlier visit instead of logging a new one.
 */

const field = 'mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal text-ink';
const lab = 'block text-sm font-semibold text-ink/80';

type Method = { key: string; label: string };

const poundsOf = (p: number) => (p === 0 ? '' : String(p / 100));

export function VisitForm({
  customerId,
  job,
  defaults,
  methods,
  today,
  back,
}: {
  customerId: string;
  job?: JobRow;
  defaults?: { pricePence: number | null; preferredPayment: string };
  methods: Method[];
  today: string;
  back: string;
}) {
  const editing = Boolean(job);
  const method = job ? job.paymentMethod : (defaults?.preferredPayment ?? '');
  const price = job ? poundsOf(job.pricePence) : defaults?.pricePence != null ? poundsOf(defaults.pricePence) : '';
  const paid = job ? job.paid : Boolean(method);
  const extras = job?.extras ?? [];
  const id = `${customerId}-${job?.id ?? 'new'}`;

  return (
    <form action={editing ? updateVisitAction : recordVisitAction} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      {job && <input type="hidden" name="jobId" value={job.id} />}
      <input type="hidden" name="back" value={back} />

      <label className={lab}>
        Date
        <input type="date" name="doneOn" required max={today} defaultValue={job?.doneOn ?? today} className={field} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={lab}>
          Price (£)
          <input name="price" inputMode="decimal" defaultValue={price} className={field} />
        </label>
        <label className={lab}>
          Paid by
          <select name="paymentMethod" defaultValue={method} className={field}>
            <option value="">Not paid</option>
            {methods.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink/80">
        <input type="checkbox" name="paid" defaultChecked={paid} className="h-5 w-5" />
        Payment received (leave unticked if they did not pay: it goes on Debts)
      </label>

      <fieldset>
        <legend className={lab}>Extras</legend>
        {[0, 1, 2].map((i) => (
          <div key={`${id}-${i}`} className="mt-1 grid grid-cols-[1fr_6rem] gap-2">
            <input name={`extraLabel${i}`} placeholder="e.g. Conservatory" defaultValue={extras[i]?.label ?? ''} className={field} aria-label={`Extra ${i + 1} name`} />
            <input
              name={`extraPrice${i}`}
              inputMode="decimal"
              placeholder="£"
              defaultValue={extras[i] ? poundsOf(extras[i].pricePence) : ''}
              className={field}
              aria-label={`Extra ${i + 1} price`}
            />
          </div>
        ))}
      </fieldset>

      <label className={lab}>
        Notes
        <textarea name="notes" rows={2} defaultValue={job?.notes ?? ''} className={field} />
      </label>

      <div className="flex gap-2">
        <button type="submit" name="status" value="done" className="flex-1 rounded-xl bg-brand-deep px-4 py-4 text-lg font-black text-white">
          {editing ? 'Save as done' : 'DONE'}
        </button>
        <button type="submit" name="status" value="missed" className="rounded-xl px-4 py-4 text-lg font-black text-amber-900 ring-2 ring-amber-500">
          {editing ? 'Save as missed' : 'MISSED'}
        </button>
      </div>
    </form>
  );
}

/** Record a debt as paid, from the Debts list or a customer's history. */
export function MarkPaidForm({ jobId, methods, back, preferred }: { jobId: string; methods: Method[]; back: string; preferred?: string }) {
  return (
    <form action={markPaidAction} className="flex items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="back" value={back} />
      <select name="paymentMethod" defaultValue={preferred ?? methods[0]?.key} aria-label="Paid by" className="rounded-lg border border-ink/20 bg-white p-2 text-sm">
        {methods.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white">
        Mark paid
      </button>
    </form>
  );
}

export function DeleteVisitForm({ jobId, back }: { jobId: string; back: string }) {
  return (
    <form action={deleteVisitAction} className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="back" value={back} />
      <label className="flex items-center gap-2 text-sm font-semibold text-red-900">
        <input type="checkbox" name="confirm" className="h-5 w-5" />
        Delete this visit for good
      </label>
      <button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white">
        Delete visit
      </button>
    </form>
  );
}
