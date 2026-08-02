# Phase 5 — Production-browser coverage

## Status

Complete locally. The CI workflow change is prepared but has not been pushed or
executed by GitHub Actions.

## Baseline

- Starting Git SHA: `58f89ad` (`test(ci): configure production browser topology`).
- Relevant areas: Playwright configuration and production launcher, authenticated
  reader routes, OPML processing, account/session authorization, chat account
  security events, and the browser CI job.
- Confirmed finding: existing browser coverage exercised public/CSP paths but did
  not cover authenticated reader persistence, OPML import, saved search behavior,
  or administrator-driven account revocation.

## Changes implemented

- Added deterministic production-build Playwright coverage for reader ingestion
  and read/star persistence, OPML folder import and duplicate handling, saved
  search lifecycle, reader setting persistence, and administrator account disable.
- Added isolated fixture users, feeds, OPML data, PostgreSQL, and separate durable
  and ephemeral Redis endpoints. The feed fixture uses a synthetic public hostname
  and retains production DNS validation before a test-only, exact-host loopback
  handoff.
- Added a guarded administrator disable-account action, audit record, authorization
  version increment, and account-security notification.
- Made the authenticated application layout require a fresh account record before
  loading reader data, so a disabled or revoked session is redirected to login.
- Fixed a concurrent first-render `UserSettings` creation race and the chat
  account-security publisher's lazy Redis connection handshake.
- Updated the browser CI job to start disposable database/Redis services, apply
  migrations, run the production-browser suite, and retain Playwright artifacts on
  failure.

## Security impact

- Disabled accounts no longer retain access to the authenticated shell after their
  current user record changes.
- The administrator action changes `authVersion`, marks the account disabled, and
  sends the existing chat revocation signal. Gateway revalidation explicitly rejects
  a disabled account even if an event is missed.
- The E2E fixture route is inert unless `ARCTIC_RSS_E2E_FIXTURES=1` and only accepts
  the configured synthetic feed host; it is not a production SSRF allowlist.

## Operational impact

- Browser CI now requires Docker on the runner for two short-lived Redis containers
  in addition to the GitHub Actions PostgreSQL service.
- Browser failures retain `playwright-report` and `test-results` for seven days.
- No production service, environment, migration, or deployment was changed.

## Database/migration impact

None. The browser job applies the existing migration history only to its disposable
PostgreSQL service.

## Tests and commands run

- `npm test` — 238 files passed, 1,100 tests passed, 3 intentionally skipped.
- `npm run lint` — passed with two pre-existing unused-parameter warnings in
  `src/app/app/actions.ts`.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `E2E_PRODUCTION=1 ARCTIC_RSS_E2E_AUTHENTICATED=1 npm run test:e2e` — 8/8 tests
  passed against the standalone production build and disposable local services.

## Evidence

- New journey suite: `e2e/authenticated-reader.spec.ts`.
- Fixture lifecycle: `e2e/global-setup.ts`, `e2e/support/fixtures.ts`, and
  `scripts/e2e/fixture-control.ts`.
- CI gate: `.github/workflows/ci.yml` job `browser-smoke`.
- Account revocation: `src/app/admin/actions.ts`,
  `src/app/app/layout.tsx`, and `src/lib/chat/security-events.ts`.

## Remaining risks

- GitHub Actions has not yet executed this unpushed workflow revision.
- The fixture-only feed routing is intentionally local and does not replace a live
  upstream ingestion or chat-gateway deployment check.

## Rollback

- Revert the Phase 5 commit to remove the browser harness, admin disable control,
  fresh layout authorization check, and CI setup together.
- No database rollback is necessary because this phase introduces no migration.

## Next phase gate

Proceed to Phase 6 only after the committed Phase 5 change has passed CI. Production
promotion remains subject to the separate approved-release procedure and a fresh
typed deployment authorization.
