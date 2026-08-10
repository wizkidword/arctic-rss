# Mobile authentication threat model

**Status:** design accepted for Phase 11 implementation; no device authorization
or device-session endpoint exists in Phase 10.

## Assets and trust boundaries

- Authorization codes, PKCE verifiers, refresh tokens, access tokens, device
  metadata, and revocation state are security-sensitive assets.
- The native application is an untrusted public client. It may protect tokens
  with platform secure storage, but it cannot keep a client secret.
- The system browser is the interactive authentication boundary. Native screens
  do not collect Arctic RSS passwords or provider credentials.
- The existing server session remains a web-session mechanism. It is not a
  durable device credential.
- The API, Auth.js state, PostgreSQL, and security audit records remain trusted
  server-side components. Redis is not the authority for token validity.

## Required Phase 11 design

1. The app opens the system browser and initiates authorization using a
   registered redirect URI, `state`, nonce, and PKCE S256 challenge.
2. The server issues a short-lived (2–5 minute), single-use authorization code
   that is stored only as a hash. Code issue and exchange both verify the
   current user, `disabledAt`, and `authVersion`.
3. The exchange validates the exact redirect URI and PKCE verifier before
   issuing a short-lived access token and a rotating refresh token.
4. Refresh tokens are stored as hashes, bound to a token family and device
   session, and have bounded lifetime and per-account device count.
5. A refresh replaces its predecessor atomically. Reuse of an already replaced
   token records a security event and revokes the complete token family.
6. Users can view non-sensitive device metadata, revoke one device, or revoke
   all mobile devices from the website. Token values and sensitive fingerprints
   are never shown.
7. Account disablement, `authVersion` changes, account deletion, and explicit
   device revocation stop new access and refresh exchanges immediately.

## Threats and controls

| Threat | Required control |
| --- | --- |
| Intercepted authorization code | PKCE S256, short TTL, hash at rest, one-time use, exact redirect URI |
| Malicious app redirect registration | Server-side fixed allowlist and exact URI comparison |
| Lost or copied refresh token | Hashed storage, rotation, family reuse detection, device revocation |
| Stale login after disablement or security change | Fresh `disabledAt` and `authVersion` checks at code issue, exchange, access validation, and refresh |
| Native client credential extraction | No embedded provider secret, database credential, Redis credential, or permanent server cookie |
| Token disclosure through diagnostics | Never log authorization codes, verifiers, access tokens, refresh tokens, or authorization headers |
| Device-session exhaustion | Per-user device-session cap, explicit eviction policy, and security audit event |
| Cross-account resource discovery | Fresh user scope plus user-owned domain queries and uniform not-found responses |

## Verification required before Phase 11 exits

- PKCE success and wrong-verifier rejection.
- Code replay, expiration, and redirect-URI mismatch rejection.
- Concurrent refresh race and previous-token reuse family revocation using real
  PostgreSQL constraints and transactions.
- Device revoke and revoke-all behavior.
- Disablement and `authVersion` changes during refresh.
- Device-session cap enforcement and privacy-safe device-management display.
