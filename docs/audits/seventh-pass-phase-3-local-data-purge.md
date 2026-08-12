# Seventh-pass Phase 3: fail-closed local data purge

## Local-session state model

The native provider now uses four explicit states:

- `signed-in`
- `signing-out`
- `signed-out-clean`
- `signed-out-cleanup-required`

`signing-out` and `signed-out-cleanup-required` are both treated as signed out
by the authenticated route group. They render no protected reader, cached
article, queue, or account content.

## Fail-closed behavior

- The session manager clears volatile credentials before persistent cleanup can
  reject.
- SecureStore deletion and SQLite owner/cache/queue purge are both attempted
  with `Promise.allSettled`; one failure cannot skip the other cleanup.
- Any persistent deletion, SQLite-open, or SQLite-purge failure moves the app
  to `signed-out-cleanup-required` rather than a normal sign-in screen.
- The only screen in that state explains that protected data is blocked and
  exposes a cleanup retry. It cannot establish a new account.
- Startup hydration awaits local purge whenever no valid session is present.
  It does not launch a background purge and present a normal signed-out app.
- Sign-in persists an owner-bound token bundle, claims the SQLite owner in a
  transaction, and only then exposes the authenticated route group. A failed
  owner claim clears the new session and returns to the cleanup boundary.

Network-only sync errors after a completed owner claim remain retryable. A
terminal session failure clears local state through the same protected path.

## Regression evidence

Focused native cleanup, SecureStore, SQLite ownership, and mobile-client tests
passed: 4 files / 28 tests. The tests inject SecureStore deletion and SQLite
purge failures and confirm that both cleanup operations run while sign-in stays
blocked. Mobile type checking and lint also passed.

No token value, cached article content, or production storage was logged or
used during this phase.
