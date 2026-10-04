---
description: Start a fresh session from docs/NEXT_STEPS.md's saved prompt — reads it, re-verifies the state, then works the priority list
argument-hint: "[anything to emphasise or leave out]"
---

# Continue from docs/NEXT_STEPS.md

Adapted from ShoppingList's `next-steps`. This is the other end of `/wrapup`: that command writes the "next
chat's prompt" fenced block at the bottom of `docs/NEXT_STEPS.md`; this command reads it back and starts
working, without Tristan having to copy and paste it.

If `$ARGUMENTS` is non-empty, it says what to emphasise or skip within the priority list. Otherwise work the
list in order. Remember the project canary: start every chat message with `Tristan, `.

## 1. Read, in this order

`CLAUDE.md`, then `docs/NEXT_STEPS.md` in full (not just the fenced prompt at the bottom — the sections above
it explain *why* the prompt says what it says), then `docs/ROADMAP.md`, then the ADRs the fenced prompt names
(at least 0007 and 0008 for the work tracker).

## 2. Re-verify the STATE block — do not trust it

The numbers were true when the last session wrote them. Time has passed and Tristan or Sam may have deployed,
migrated or changed something. Before acting:

```bash
git status --short && git log --oneline -5
npm run typecheck
npm test            # the database tests are slow (a couple of minutes); that is normal
```

Re-probe anything listed under "what a human still has to do" rather than assuming it is still blocked:
`npx wrangler whoami`, `gh auth status`, and for the deployed state
`CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc npx wrangler deployments list` (add `--env staging`).
If reality has moved on from what is written, say so plainly before continuing.

## 3. Work the priority list, in order

Respect every ⚠️ constraint attached to each task and everything in the fenced prompt's guardrails: they exist
because an earlier session paid to learn them (see the Traps list in `docs/NEXT_STEPS.md`). Skip anything
genuinely blocked on Tristan or Sam rather than attempting a workaround; flag it and move on.

Deploy and migrate rules: staging deploys and staging migrations happen when Tristan says so for that piece of
work; **production is never migrated or deployed without an explicit instruction in the current session.**

## 4. Finish the same way every session does

Run `/wrapup` before ending the session.
