# Changelog

Newest first. Led by what changed for Sam, then the numbers and what is still untested.

## 2026-10-04 (session 4): paragraphs, then the work tracker

**For Sam**
- **Paragraphs work.** Body text on the front page (intro, services, prices, contact) used to collapse every new line into one block. It is now written in a proper text editor: size, colour, bold/italic/underline, headings, lists, links, alignment, and Enter starts a new paragraph. A blank line stays a blank line. Text blocks and the descriptions of services he adds use it too.
- **Customers** (`/admin/customers`): search; filters for Due and Owing and for each round; Call, Text and WhatsApp buttons; a "Coming tomorrow" text that opens his messaging app with the words filled in; add a customer on the doorstep with a 📍 Grab location button, a price and how many weeks between cleans; edit; delete (type "delete"; their details, visits and photos go for good); import from Squeegee's CSV (safe to repeat, never overwrites edits).
- **Rounds:** named areas worked on a weekday; a customer can be in more than one.
- **Work** (`/admin/work`): who is due this week by round, with DONE (opens a panel with the usual price and payment method already filled in, extras, a date that can't be in the future) and a one-tap MISSED; Debts (visits nobody paid for, with Mark paid); Payments.
- **Visit history** on each customer, with edit and delete for any past visit.
- **Map** (`/admin/customers/map`): every customer with a location as a colour-coded pin (red owes, orange overdue, yellow due this week, green up to date, grey no schedule), tap the key to filter.
- **Bottom tab bar** on the admin pages (Home, Work, Customers, Enquiries, Site), like Rachel's.
- Replies and texts no longer greet "Hi TRISTAN": all-caps or all-lowercase first names are tidied.

**Under the hood:** ADR 0007 (rich text), ADR 0008 (the tracker is built in this repo, for Sam first; WindowsWayfinder may come later and separately); migration 0010; `npm run db:seed-demo` (staging only); `/wrapup` and `/nextsteps` commands.

**Numbers:** 198 tests pass in 26 files, typecheck and build clean. The database tests now take about 2 minutes (they were timing out at 10 s on a busy machine; limit raised to 60 s).

**Still untested:** all of it in a real browser and on a real phone. Deployed to staging only; production has the editor but not the tracker, and production has no Worker secrets set yet, so its contact form and admin login do not work until `scripts/set-prod-secrets.sh` is run.
