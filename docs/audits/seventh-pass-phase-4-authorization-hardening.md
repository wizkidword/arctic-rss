# Seventh-pass Phase 4: authorization hardening

The browser approval POST no longer calls `Request.formData()`. It accepts only
a small identity-encoded URL form, rejects multipart, compressed, oversized,
duplicate, and unknown fields under a five-second read deadline, and applies an
IP limiter before reading the body. It requires an exact same-origin `Origin`
header, then authenticates and applies the user limiter.

An approval now requires the account's current credentials password immediately
before code issuance. The pending authorization row carries a hash of the
authenticated browser session cookie, so the approval token is unusable from a
different browser session. OAuth-only accounts fail closed until a genuine
provider reauthentication continuation is implemented; no global
`User.lastLoginAt` value is used as a substitute.

The legacy direct code helper now refuses non-test runtime use. The App Link
browser fallback removes its query string from history, and the edge-proxy has
a callback-specific `access_log off` rule so the one-time code is not retained
by that access log.

Focused tests cover malformed forms, missing and hostile origins, the
pre-body limiter, browser-session binding, password reauthentication, and the
test-only direct helper boundary. This is source evidence only: native mobile
authorization remains disabled and no production ingress or authentication
configuration was changed.
