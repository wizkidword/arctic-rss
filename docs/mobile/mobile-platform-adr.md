# Mobile platform ADR

**Status:** accepted by owner approval `APPROVE MOBILE PLATFORM ADR` on 2026-08-10.
**Scope:** The owner approval covers the Phase 10 architecture. Phase 11 now
implements the approved browser-mediated device-authentication boundary locally;
no native application, Android build, deployment, or Google Play action is
authorized by this ADR.

## Context

Arctic RSS needs a first-party Android client without creating another backend,
coupling native code to Next.js Server Actions, or turning application internals
into a public developer platform. The web application already owns
authorization, reader state, source subscriptions, podcasts, collections, saved
views, and briefings. The mobile client must consume those same domain rules.

## Decision

- The proposed native stack is Expo, React Native, and Expo Router. No Expo
  workspace or native screen is created in this phase.
- Arctic RSS keeps one backend: the existing Next.js, Prisma, PostgreSQL,
  Redis, BullMQ, and Auth.js platform. Native clients never access the database,
  Redis, server actions, or service credentials directly.
- `/api/v1` is a private first-party client API, not a public API. It makes no
  promise of external API keys, webhooks, third-party client support, or
  backwards compatibility outside the Arctic RSS applications.
- The API exposes explicit DTOs from `packages/api-contract`; it does not
  expose Prisma-generated shapes. Its versioned OpenAPI artifact is generated
  at `docs/mobile/openapi-v1.json`.
- Phase 10 read requests use the existing fresh Auth.js web-session boundary so
  the contract can be exercised without weakening account disablement or
  `authVersion` revocation. Phase 11 must replace that native-client boundary
  with browser-mediated authorization-code exchange with PKCE and rotating,
  hashed device refresh tokens. Server cookies are not permanent native
  credentials.
- User data responses are `private, no-store`. API v1 uses cursor pagination
  and a maximum page size of 50. Article/search list DTOs deliberately exclude
  article bodies; a separately authorized detail endpoint provides only the
  selected article's sanitized HTML and text.
- The API applies one private-read rate-limit family and low-cardinality
  telemetry only: endpoint family, status, duration, page size, rate-limit
  result, auth mode, and request ID. Search terms, article bodies, tokens,
  account identifiers, and email addresses are never telemetry dimensions.
- Mobile v1 will have limited offline data only: recently opened articles,
  starred items, selected collections, recent podcast metadata/positions,
  queued idempotent mutations, and one sync cursor. Full-library offline sync
  is explicitly out of scope.
- Phase 12 will add incremental sync, tombstones, idempotent mutations,
  deep-link implementation, and notification preferences. Its stable link map
  is reserved as `/articles/:id`, `/podcast-episodes/:id`, `/collections/:id`,
  `/saved-views/:id`, and `/briefings/:id`, with HTTPS web fallback.
- Advanced source management, OPML, bulk source actions, administration, chat,
  provider controls, and account-export generation remain web-only in mobile
  v1.

## Versioning and deprecation policy

`/api/v1` is the current first-party contract. Compatible changes are additive:
new optional fields and endpoints may be introduced without changing existing
field meaning. Removing or changing required fields requires a new major path
such as `/api/v2`, a documented in-app migration plan, and a supported overlap
period for Arctic RSS clients. The OpenAPI artifact and Zod schemas are the
reviewed source of truth. This policy does not create a public compatibility
commitment.

## Consequences

Phase 11 can build device authorization on an already bounded API surface.
Phase 12 can make writes and sync safe without changing response envelopes.
Phase 13 may begin only after the Phase 10–12 security and integration gates
pass and the owner supplies `APPROVE ANDROID INTERNAL ALPHA`.

## Rejected alternatives

- A WebView-only shell: it would preserve fragile Server Action coupling and is
  not the final Android architecture.
- A second mobile backend or direct Prisma access: it would duplicate policy
  and widen production credentials.
- Reusing browser cookies as durable device tokens: it would not provide
  device-specific rotation, reuse detection, or revocation.
- A public API launch: it would expand compatibility, abuse-prevention, and
  support obligations beyond the first-party mobile goal.
