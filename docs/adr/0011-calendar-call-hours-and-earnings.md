# 0011: Calendar, call hours and earnings

Status: Accepted (2026-10-04, session 7, built overnight while Tristan slept; nothing seen on a phone yet)

## Calendar and call hours (migration 0012)

Tristan asked for the public "Call me" button to follow Sam's hours: only at certain times of day, never at weekends,
and "I'm not working right now, leave me a message" outside them, with Sam setting hours from a calendar like
HairByRachel's. Decisions:

- **Two tables.** `call_hours` is the usual week (a row per window; no row for a day = no calls that day, which is
  how weekends are off). `schedule_entries` is the dated layer on top: a round Sam is working (`round`), an extra
  window he takes calls (`callable`), or `not_callable` (a day off). Overrides-only, like content: with no rows the
  button always shows.
- **Rules are pure** (`src/lib/schedule-shared.ts`): a `not_callable` entry switches the whole day off, otherwise
  the day's calls are the usual windows plus any extra `callable` windows. A window is open at its start and closed
  at its finish. Times are wall-clock Europe/London (so BST/GMT needs no care); dates are London dates.
- **Fails open.** If the hours cannot be read, or Sam has set none, the Call button shows. A missed call costs more
  than an unwanted one. A database hiccup must not take the phone number off the site.
- **Public page.** The hero phone link and the contact section's Call button are swapped for the away message
  (`<Ed id="hero.away">` and `<Ed id="contact.away">`, editable and Welsh-drafted). Text, WhatsApp and Email stay
  visible, because those are messages, not calls. The page was already rendered per request, so no caching change.
  In pencil mode both are shown (`CallSwitch`), labelled "Shown during your call hours" and "Shown out of hours" with
  "showing now" on the live one, so Sam can edit the away wording at any time of day (added later the same day at Tristan's request).
- **Calendar UI** (`/admin/calendar`): week view as a list of day cards (phone-first), month view as a grid with dots;
  a round that has a usual weekday is offered as a one-tap dashed "+ Nash (usual)". Usual hours live on Settings.
- **No Google Calendar link.** Tristan chose "build a calendar view like Rachel's" instead of reading Sam's Google
  Calendar, so there is no OAuth scope change and the consent screen stays as it is.
- **Navigation.** Six tabs: Home, Work, Calendar, Customers, Enquiries, Settings. Settings is a hub (rounds, call
  hours, ways of paying, Templates, Logo and colour); Earnings hangs off Work and the admin home.

## Earnings (migration 0013)

An Earnings page like Rachel's: money **received** in a period (today, this week, this month, last month, this year,
or any dates), by week, by way of paying, top extras and customers, work done vs money received, missed visits, and
what is still owed (all time). Money received is counted on the day it came in, so `jobs.paid_on` was added:
a visit paid on the day is paid on its visit date; a debt cleared later is paid on the day it was marked paid;
existing paid visits were backfilled to their visit date, the best that can be known. Reports read
`coalesce(paid_on, done_on)` so rows written without it (the demo seed) still count. A CSV download (admin-checked
route) neutralises cells that start with `= + - @` so a customer named `=HYPERLINK(...)` cannot run in a spreadsheet.
The CSV holds customer names, so it is personal data: it is never written to the repo.

## Other changes in the same session

Payment methods can be added, renamed and removed (a method that any visit or customer uses cannot be removed);
rounds can be renamed, given a day and ordered (drag the ☰ handle, with up/down arrows as the keyboard-friendly alternative; each change saves at once); "Set up several" sets price, frequency, round and usual payment for ticked customers; a customer's
last-cleaned date can be corrected; after DONE the Work screen offers "Add photos" for that visit, and the visit
list shows photo counts.

## Why it might be undone

Sam may want Google Calendar to drive call hours after all (add a scope or an iCal feed and feed it into
`schedule_entries`). Drag-to-order is pointer-event based (`RoundOrderList`), not the HTML5 drag API, which does not work on touch screens.
