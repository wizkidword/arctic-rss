# Request-scoped fresh-user evidence

Fourth-pass Phase 9E traces the protected-request duplicate in source:

1. `auth()` runs the Auth.js JWT callback, which reads the authoritative user
   through `getFreshUserState` in `src/auth.ts`.
2. Protected pages and routes then call `requireFreshUser` or
   `requireFreshAdmin`, which previously read the same record again.

`withAuthenticatedRequestScope` now begins an `AsyncLocalStorage` scope before
calling `auth()`. The Auth.js callback and the subsequent fresh authorization
check share one promise from the scope's resolver. The resolver is neither
returned nor stored globally; each independent protected operation starts with
a new resolver.

Safety boundaries:

- No resolver exists outside an explicit protected request scope.
- A new scope creates a new resolver, including for concurrent requests.
- The authorization check still rejects missing users, disabled users, changed
  `authVersion`, changed role, and changed plan values.
- Callers that do not already have an authenticated-request scope create one
  before authenticating, so they retain the same authoritative validation.

The focused tests verify one read inside the Auth.js-plus-protected-render path,
immediate disabled-account rejection, old-session revocation, stale role and
plan rejection, and isolation between concurrent request scopes.
