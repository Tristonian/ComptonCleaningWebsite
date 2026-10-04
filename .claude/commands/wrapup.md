---
description: End-of-session wrap-up — docs, ADRs, commits, push, a Tristan-and-Rachel explainer, and the next chat's prompt
argument-hint: "[anything to emphasise or leave out]"
---

# Wrap-up (Compton Cleaning)

Adapted from VideoGameDiaries' `StandardWrapUp`. Tristan asks for this at the end of most sessions. Do all
parts, in order, and do not stop early: a half-done wrap-up is worse than none, because the next session
trusts these files.

If `$ARGUMENTS` is non-empty, it says what to emphasise or skip. Otherwise do everything below.

Remember the project canary: start every chat message with `Tristan, `.

## Before you write anything

Run the checks and record the REAL numbers. Never carry a count forward from an earlier message:

```bash
npm run typecheck
npm test
npx next build
```

The database tests boot an in-process Postgres per test and can take a couple of minutes; that is normal
(the hook timeout is 60 s). If something is red, say so plainly and fix it or flag it. Do not describe a
failing thing as done.

Also record where things are actually deployed, by asking, not assuming:

```bash
git status --short && git log --oneline -5 && git rev-list --left-right --count main...origin/main
CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc npx wrangler deployments list           # production
CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc npx wrangler deployments list --env staging
```

and which migrations are applied on which Neon branch (`npm run db:migrate -- --branch staging` prints
"nothing to apply" when current; do NOT run it against production as a probe, that applies them).

## 1. docs/ROADMAP.md

Move checkboxes to match what is actually true. A thing that works but nobody has used on a real phone stays
unchecked with a ⚠️ saying so. Put the caveats inline where the item is, not in a footnote.

## 2. docs/CHANGELOG.md

Create it if missing. A new dated section at the top. Lead with what changed for Sam (the person using it),
not with the files touched. Include the measured numbers and a "what is still untested" line.

## 3. docs/adr/

An ADR for **any decision Tristan could plausibly undo later without knowing why it was made**. Add the row to
`docs/adr/README.md` AND the file. If a decision was genuinely his rather than yours, say so in the entry.
If nothing this session meets that bar, say "no new ADR needed" and why.

## 4. docs/NEXT_STEPS.md — rewrite, do not append

This is the file a cold session reads first, so it must describe the world as it is NOW, not as a diff. Keep:

- the banner with real counts and the real deployed state (staging vs production, migrations per branch)
- what was built this session, "do not redo"
- **what a human still has to do** — and before writing that, actually PROBE whether it is true
  (`npx wrangler whoami`, `gh auth status`). Do not hand back a command you never tried
- what is untested, honestly, especially anything nobody has clicked on a real phone
- the accumulated "traps this codebase has walked into" list, plus any new ones. A trap earns its place if it
  cost more than ten minutes and would cost the same again

Also make sure `CLAUDE.md`'s Status paragraph is not stale.

## 5. Commit and push

Logical chunks, not one big commit. Messages explain **why**, name the trade-off, and are honest about what is
untested. End each with the attribution line the session was given. Push `main` and `staging` (they move
together; a push deploys nothing, there is no deploy workflow). **The repo is public: re-check that no
customer data, `.env.local`, or the Squeegee export is staged** (`git diff --cached --stat`). Do not deploy
or migrate production as part of a wrap-up unless Tristan said to in this session.

## 6. The Tristan-and-Rachel conversation

A plain-language explainer, written as if Tristan is telling Rachel what he got done. She is not technical and
does not need to be. Rules:

- **Real numbers**, not "lots" or "several"
- **Include the unfinished and the broken.** A version where everything went well is not the thing he asked for
- No jargon without a plain-English gloss in the same sentence
- Short. It is a conversation, not a report

## 7. The next chat's prompt

A complete, self-contained prompt to paste into a fresh session (also saved as the fenced block at the bottom
of `docs/NEXT_STEPS.md`, which is what `/nextsteps` reads). It must carry:

- where to work, and what to read first (`CLAUDE.md`, `docs/NEXT_STEPS.md`, `docs/ROADMAP.md`, the ADRs it names)
- a STATE block with verified numbers
- the tasks, in priority order, with the ⚠️ constraints attached to each
- what cannot be done without Tristan or Sam
- the guardrails that would otherwise be rediscovered the hard way
- "finish with `/wrapup`"

Write it in a fenced block so he can copy it in one go.
