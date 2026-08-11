# ADR 0001: registered Android client authorization

**Status:** accepted for sixth-pass source work; production enablement remains
owner-gated.

## Decision

- The production public-client ID is `android:com.arcticrss.reader`.
- The only production authorization redirect is the exact claimed HTTPS URI
  `https://arcticrss.com/mobile/auth/callback`.
- A private-use custom scheme is development-only. It is never accepted for a
  production authorization or exchange.
- `MOBILE_NATIVE_AUTHORIZATION_ENABLED` contains new native authorization
  until a real signing identity and Android App Link verification exist. Its
  default is disabled; setting it requires an explicit operational decision.
- Authorization validates an exact registered client ID and redirect URI,
  requires PKCE S256, state, nonce, explicit browser approval, and a current
  authenticated browser session. It has no mobile client secret.
- The authorization page displays the registered Arctic RSS client name and
  current account. Device-provided name, platform, and app version are
  descriptive only and never prove client identity.

## Rationale

Custom schemes can be claimed by another installed application. A claimed
HTTPS App Link binds the callback to the package and signing certificate, but
only after the owner creates the real signing identity and the site publishes
the exact `assetlinks.json` statement. No placeholder fingerprint may be
published. Browser GET requests validate and render only; a protected POST
issues the one-time code so a signed-in browser cannot silently add a device.

## Consequences

The existing custom-scheme flow is a compatibility/development concern, not a
production fallback. Production remains disabled until the exact package,
certificate fingerprint, App Link proof, recent-auth implementation, and
owner authorization are recorded.
