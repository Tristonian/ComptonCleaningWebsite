# ADR 0003 — Admin auth: Google OAuth + email allow-list, own sessions

- **Status:** Accepted
- **Date:** 2026-10-04
- **Context:** Sam edits prices, text and photos from his phone. Replaces the Resend
  magic-link idea in the original brief. Same family as HairByRachel ADR 0006 and
  WindowsWayfinder ADR-003 (own auth, no auth vendor).

## Context

Sam already has a Google account on his phone, so "Sign in with Google" is one tap and nothing
to remember or lose. A magic link needs working email deliverability first (SPF/DKIM/DMARC on
a domain we do not yet control) and a trip to his inbox each time. Public sign-up must be
impossible: this is a one- or two-person admin, not a user base.

## Decision

- **Google OAuth 2.0 authorization-code flow with PKCE**, scopes `openid email profile`. No
  auth vendor and no Auth.js; the flow is ~150 lines in `src/lib/auth/google.ts`.
- **Allow-list gate:** `ADMIN_ALLOWED_EMAILS` (comma-separated). A login succeeds only if the
  ID token's `email_verified` is `true` **and** the lower-cased email is on the list. Google
  accepting someone is never sufficient on its own.
- **Our own session, not Google's:** on success we mint a random 32-byte token, store only its
  SHA-256 in the `sessions` table, and set it in an `HttpOnly; Secure; SameSite=Lax` cookie
  (30 days, sliding). Logout deletes the row.
- **CSRF / replay:** `state` and the PKCE verifier live in a short-lived (10 min) signed
  cookie, checked and cleared on callback.
- **Validate the ID token properly:** signature against Google's JWKS, plus `iss`, `aud`
  (our client id), `exp`. Never trust a decoded-but-unverified token, even one received
  straight from the token endpoint.
- **Redirect URIs** are registered per environment: production, staging Worker, localhost.
- **Fallback:** if Google is unavailable or Sam loses access, Tristan adds an email to the
  allow-list or rotates secrets with `wrangler secret put`. A Resend magic link can be added
  later as a second provider behind the same allow-list and `sessions` table; nothing here
  prevents it.

## Consequences

- **Good:** no passwords, no email deliverability dependency for launch, one tap on a phone.
- **Good:** adding or removing an admin is one secret change, as in HairByRachel.
- **Good:** only a session hash is stored, so a database leak does not hand out logins.
- **Trade-off:** requires a Google Cloud OAuth client (hand step, see
  `docs/INFRASTRUCTURE.md`). Consent screen stays on basic scopes, so no Google verification
  review is needed; publish it to "In production" so test-user limits do not apply.
- **Trade-off:** locked to Google accounts. Acceptable for two admins; ADR-able if that
  changes.
