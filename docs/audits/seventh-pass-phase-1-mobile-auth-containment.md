# Seventh-pass Phase 1: mobile-authorization containment

## Source correction

The existing containment flag already guarded native authorization initiation
and code exchange. This phase applies that same guard to refresh-token
rotation, which can extend a native device session.

When `MOBILE_NATIVE_AUTHORIZATION_ENABLED` is missing, `false`, malformed, or
otherwise not exactly `true`, all three routes now return a generic no-store
404 before parsing a request body, applying a limiter, looking up an account,
or writing a mobile record:

- `GET /api/mobile/authorize`
- `POST /api/v1/device-authorizations/exchange`
- `POST /api/v1/device-sessions/refresh`

The flag remains an explicit operator decision; no source change enables
native authorization in production. Ordinary browser authentication is outside
these routes and is unaffected.

## Read-only verification

Run only against an origin where containment is expected:

```bash
npm run mobile:verify-auth-containment -- --origin https://example.test
```

The command sends no credentials, codes, refresh tokens, or request bodies. It
does not print query strings or response bodies and exits nonzero unless each
route returns a no-store 404.

## Emergency package assessment

The recorded production revision (`7e5f7fe`) contains the legacy native
authorization routes and predates the containment implementation. A separate
minimal hotfix worktree must therefore be prepared from that exact revision,
with no Prisma migration or unrelated mobile change. Preparing the package is
source control only; it is not deployment authorization.

## Owner-gated actions

- Run the read-only verification against production only when the owner wants
  current runtime evidence.
- Deploy only through `scripts/windows/deploy-approved-release.ps1` after a
  fresh exact `DEPLOY <short-sha>` approval and all controller gates pass.
