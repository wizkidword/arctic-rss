# Mobile native-authorization containment

## Source behavior

`MOBILE_NATIVE_AUTHORIZATION_ENABLED` controls new browser-mediated native
authorization. It is disabled unless its value is exactly `true`.

- When disabled, `GET /api/mobile/authorize` returns a generic `404` before it
  parses authorization parameters or reads the browser session.
- When disabled, `POST /api/v1/device-authorizations/exchange` returns a
  generic first-party API `404` before it reads the request body.
- Existing bearer-session API requests and refreshes are unchanged. The flag
  prevents issuance of new native sessions; it does not pretend to revoke an
  already-issued test family.

This source flag is not deployment evidence. A production environment remains
unchanged until an owner approves an exact website release under the normal
`DEPLOY <short-sha>` process.

## Safe operator checks

1. In a non-production approved environment, omit the variable and confirm
   both new-authorization routes return `404` without request-specific detail.
2. Set the variable to exactly `true` only for reviewed internal testing after
   the registered-client and callback gates have been implemented.
3. Inventory active mobile families through the existing authenticated device
   management surface or an aggregate server-side query. Do not print tokens,
   token hashes, user IDs, or device labels in tickets or logs.
4. Revoke an individual test family from `/app/settings/devices`, or revoke
   all mobile sessions through the same reviewed account-management flow.

The flag must remain disabled in production until the owner has a real signing
identity, claimed HTTPS App Link verification, an explicit authorization flow,
and an exact-commit deployment approval.
