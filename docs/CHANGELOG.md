# Changelog

Newest first. Led by what changed for Sam, then the numbers and what is still untested.

## 2026-10-04 (session 6): Templates, and the work tracker reaches production

**For Sam**
- **Templates** (`/admin/templates`, new ✉️ tab): every text and email he sends is listed. Tap one to switch it off or change the wording, or Reset to the original. Switching "Coming tomorrow" off removes that button from the customer list; the four enquiry replies (thanks, price, more info, booked) are the starting points on the reply form, and only switched-on ones are offered. Nothing is ever sent without him pressing send.
- Texts and replies greet ALL-CAPS or lower-case first names tidily ("Hi Tristan").
- **Production now has the work tracker, the Templates screen and its Worker secrets** (Tristan ran `set-prod-secrets.sh`, migrate and deploy by hand). Admin login on the live site should now work, but nobody has signed in there yet.

**Under the hood:** ADR 0010; migration 0011 (`message_templates`); `src/lib/templates.ts`, `message-templates.ts` (registry), `components/admin/TemplateEditor.tsx`. Emails stay plain text (the reply form and mailer are plain text).

**Numbers:** 223 tests pass in 29 files (6 new), typecheck and build clean. Staging Worker `debb7f44` (migrated through 0011); production Worker `c157c645`. `main` = `staging`, pushed.

**Still untested:** Templates on a phone beyond Tristan switching "Coming tomorrow" off and seeing the button go; the six-tab bar's width on a small phone; editing a reply template and seeing it on a real enquiry; production migrations 0010 and 0011 were run by Tristan and not independently probed; Sam's own Google login on production.

## 2026-10-04 (session 5): weather and photos on visits

**For Sam**
- **Weather** on the admin home: today in plain words ("Good for windows", "Fine, with care", "Poor for windows", "Ladder warning") with the reason, then the week with rain chance, top gust and overnight low. On the Work screen, picking a round shows the weather for where that round's customers are, with the round's usual day outlined.
- **Photos on a visit:** on a customer's visit, 📷 Take photo opens the camera, 🖼️ From gallery picks from the phone (several at once). Up to 8 per visit, tap to open full size, Remove asks twice. Photos are shrunk before upload, and the phone's GPS position is dropped. Deleting a photo, a visit or a customer also deletes the stored file once nothing else uses it.

**Under the hood:** ADR 0009; `src/lib/weather.ts`, `job-photos.ts`, `photo-store.ts`; no migration (the `job_photos` table already existed). Deleting a page photo now keeps the file if a visit photo shares it.

**Numbers:** 217 tests pass in 28 files (19 new), typecheck and build clean. Staging Worker `42612c3f`; production untouched.

**Still untested:** weather on a phone beyond the home tile (the per-round tile), photo upload from the gallery, remove, and the stored-file cleanup on a real device; the session 4 list in NEXT_STEPS is still unchecked.

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
