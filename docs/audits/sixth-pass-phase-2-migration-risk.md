# Sixth-pass Phase 2 migration risk

**Status:** source-reviewed; not applied to any production database.

`20260811090000_add_mobile_authorization_requests` is additive:

- it adds nullable `DeviceAuthorizationCode.clientId`; old, already-issued
  codes have a maximum five-minute lifetime and are intentionally not
  backfilled;
- it creates `MobileAuthorizationRequest` for bounded, one-time browser
  approval state, with a user foreign key and expiry indexes;
- it changes no existing token or session row and deletes no data.

New exchange code requires a matching `clientId`, so a pre-migration code
cannot be exchanged after the application update. This intentional fail-closed
window is bounded by the prior code TTL. Rollback before enabling native
authorization is application-only: keep the new table and nullable column,
then restore the previous application release. No down migration is proposed.

The migration must be rehearsed against a disposable PostgreSQL fixture and
reviewed again before any separately approved deployment.
