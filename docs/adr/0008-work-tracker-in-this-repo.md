# ADR 0008 — The work tracker is built here, for Sam first

- **Status:** Accepted (supersedes the WindowsWayfinder paragraph of ADR 0007)
- **Date:** 2026-10-04
- **Context:** Sam wants to move off Squeegee. He needs a phone-first tool to see who is due, mark
  visits done or missed, record extras and payment, call or text customers, and add a customer on the
  doorstep. Tristan decided: build for Sam today and get him running; WindowsWayfinder (the route
  planner) may be built later, separately. ADR 0007 had said the opposite an hour earlier.

## Decision

- **The tracker lives in `/admin` of this site**, on the same Neon database, auth and allow-list
  (ADR 0003, 0005). It is not a separate app, and it does not try to be the route planner.
- **Model** (migration 0010):
  - `customers` gains `price_pence`, `frequency_weeks` (NULL = one-off), `preferred_payment`, `baseline_done_on`
    (a last clean from before the tracker) and `squeegee_ref` (unique; makes re-imports safe).
  - `rounds` are named areas worked on a weekday. A customer can be in **several** rounds (`customer_rounds`,
    with a position for drag-to-order), because rounds overlap.
  - `jobs` is one row per visit: `done` or `missed`, a date that is never in the future, price, payment method,
    `paid`, notes. `job_extras` are the worksheet lines. `job_photos` hold R2 hashes (bytes under `photo/<hash>`).
  - `payment_methods` is a table Sam can add to; seeded with transfer, cash, card.
- **Due and owing are computed, never stored.** Due = last done + frequency (last done is the later of the
  baseline and the newest `done` job; never-done customers count from when they were added). Owing = done jobs
  not marked paid, plus their extras. A debt is just "no payment was made" (the customer was out): marking it
  paid later clears it. Missed visits do not move the due date.
- **Money is integer pence**, parsed from pounds without floating point.
- **DONE opens a panel** with the customer's usual price and payment pre-filled and editable (date, price,
  method, extras, photos). One tap to open, one to confirm.
- **Delete means delete.** A customer who asks is removed along with their visits, extras, photo rows and round
  places, in one statement; enquiries that pointed at them lose the link. The audit log stores only the id,
  never a name, phone or address, so the log cannot undo the deletion. Photo bytes in R2 are removed when
  photos are built.
- **Squeegee import** (`Cust Ref, Title, First Name, Last Name, Address Line 1, Phone, Mobile, Source, Added`):
  names, addresses and phones only (the export has no price, frequency, postcode or last-clean date). A
  reference already imported is skipped, so nothing Sam has edited is overwritten. The real export is
  personal data and is never committed; tests use invented people.
- **Messages**: call, text and WhatsApp are plain `tel:`, `sms:` and `wa.me` links, so nothing is sent from
  the server and nothing needs SMSWorks yet. The "I'm coming tomorrow" text pre-fills the phone's own
  messaging app. Defaults live in `src/lib/message-templates.ts`; the Templates screen will make them
  switchable and editable (overrides-only). SMSWorks is wired in later behind the same templates.
- **Weather** on the admin home uses Open-Meteo (free, no key), built after the tracker screens.

## Consequences
- ADR 0007's "WindowsWayfinder stays separate" no longer applies to the tracker; the route planner itself
  is still not part of this repo. CLAUDE.md is updated to match.
- The admin grows well past enquiries: keep each screen server-rendered and phone-first, with small client
  components only where the phone is needed (geolocation, file pick, drag).
- Invoices are a later feature and will build on `jobs` and `job_extras`.
