# 0010: Templates are overrides-only, field by field, and emails stay plain text

Status: Accepted (2026-10-04, session 6)

## Decisions

**Overrides-only, per field.** Defaults live in code (`src/lib/message-templates.ts`). A `message_templates` row
exists only where Sam changed something, and its `subject` and `body` are NULL while they are still the default.
So switching a template off never freezes its wording, and a later improvement to a default still reaches him.
Saving the original wording with the template on deletes the row. This is the same shape as page content and the
contact-form lists (ADR 0004, migration 0009).

**Off means gone, not blank.** A switched-off "Coming tomorrow" removes the button; switched-off reply templates are
left out of the reply form's list. Nothing is ever sent without Sam pressing send, so there is no "disabled but
still sends" state to reason about.

**Emails stay plain text** (Claude's choice, not Tristan's). The roadmap line said "rich editor for emails", but the
reply form and `sendMail` are plain text. Rich emails mean HTML sending, sanitising for mail clients and a text
fallback, which is a separate piece of work. If wanted, do it as its own task and add a body-format column then.

**Audit rows hold the template key only**, never the wording.

## Why it might be undone

Someone may want a "default changed, ask Sam to re-confirm" flow, or per-language (Welsh) templates, or SMSWorks
sending; none exist yet. SMSWorks should plug in behind the same keys.
