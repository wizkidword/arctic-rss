# Phase 7 — Transcript abuse controls

## Status

Implemented locally. It has not been released to production; promotion remains
subject to the approved-release procedure and a fresh typed deployment
authorization.

## Changes implemented

- Added a Redis-backed, fail-closed transcript endpoint limit: 12 requests per
  authenticated user and 30 per trusted Cloudflare client IP in five minutes.
  Limited requests receive `429`, `Retry-After`, and `Cache-Control: private,
  no-store`.
- Added a four-request, process-local transcript outbound semaphore to the
  existing safe-fetch path. It composes with, and does not replace, the existing
  per-host limiter; the total request deadline applies while waiting for either
  limit.
- Added ephemeral Redis caching after the active-subscription check. A cache key
  is a SHA-256 hash of the normalized transcript URL plus the feed-reference
  type, language, and relation. Positive entries expire after two minutes;
  failure results after 30 seconds.
- Limited cached serialized entries to 512 KiB, reject malformed or oversized
  cache values, and retain no transcript body in the primary database.
- Kept publisher URL validation, redirect revalidation, content-type allowlist,
  one MiB response cap, safe-fetch duration limit, sanitization, and 3,000-cue
  cap intact.
- Added structured, URL-free failure categories for unauthorized, rate-limited,
  unsafe destination, timeout, oversized response, unsupported format, parse
  failure, and upstream unavailable outcomes.

## Verification

- Focused transcript, rate-limit, URL-safety, and route coverage: 61 tests
  passed.
- `npm run typecheck` passed.
- Targeted ESLint passed without warnings.
- `npm test` passed: 240 files and 1,120 tests; 2 files and 3 tests skipped by
  existing suite configuration.

## Security and operational notes

- Cache lookup happens only after the database query proves that the requester
  has an active subscription to the episode's podcast. Shared cache entries do
  not bypass authorization.
- Rate-limit-store unavailability returns `503` before an outbound request.
  Cache failures degrade to a miss and never disclose Redis details.
- The global semaphore is process-local by design. It bounds work on each web
  process while the Redis rate limit bounds request admission across processes.

## Rollback

Revert the Phase 7 commit to remove the rate-limit action, temporary cache,
global fetch limiter, endpoint handling, and associated tests together. No
migration, persisted transcript-body data, or production configuration change is
introduced by this phase.
