# Session revocation runbook

Arctic RSS uses a versioned JWT security stamp. Each user has an
`authVersion`; a signed-in token carries the same value. The application
rejects the token when it no longer matches the current user record, when the
role or plan changed, or when the account is disabled.

## When sessions are revoked automatically

The application increments `authVersion` when a password reset succeeds or a
local administrator bootstrap changes a user from `USER` to `ADMIN`. Future
role changes, suspensions, and material account-security changes must do the
same inside the transaction that changes the account.

## Revoke a user's sessions

1. Sign in as a current administrator and open `/admin`.
2. In the Users table, select **Revoke sessions** for the target account.
3. The action increments the target user's `authVersion` and writes a
   `USER_SESSIONS_REVOKED` audit event.
4. The target's existing cookies are rejected at their next request. They must
   sign in again.

Do not use this dashboard action to handle an active incident by itself.
Preserve relevant logs and follow the incident process before changing other
credentials or access controls.

## SEC-002 deployment and verification

This release intentionally rejects every pre-SEC-002 JWT because those tokens
do not contain `authVersion`.

1. Complete the backup and recovery-console checks in
   [backup-restore-checklist.md](backup-restore-checklist.md).
2. Apply the committed migration before starting the new web and worker
   images. It is additive: existing users receive `authVersion = 0`.
3. Rebuild and recreate web and worker, then verify migration status, local
   health, public health, and an administrator sign-in.
4. Do not rotate `AUTH_SECRET` as part of this release. A deliberate secret
   rotation is a separate, global session-invalidating operation.

Verify that an old browser session is redirected to login, a newly signed-in
administrator can open `/admin`, a regular user cannot invoke an admin Server
Action, and the revoke control prevents the targeted cookie from making a
subsequent request.

## Rollback

The database migration is backward-compatible because the new column has a
default. However, rolling web code back to a release that does not enforce the
security stamp reintroduces stale-session risk. Prefer a forward fix. If an
emergency code rollback is unavoidable, explicitly record that security
degradation, restore the matching database only when required, and deploy the
SEC-002 code again as soon as service is stable.
