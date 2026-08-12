# Seventh-pass release package

**Status:** source-verification package only. It is not a deployment, signed
Android artifact, or release authorization.

| Field | Value |
| --- | --- |
| Working branch | `codex/seventh-pass-hardening` |
| Implementation revision | `64aa79eeea95dd57eb3cbe560d050080513bd64e` |
| Baseline revision | `6672dad21274c25a2d90f0db9aaf007f053515a6` |
| Seventh-pass commit sequence | `30ec103`, `e4ca9e0`, `67680fc`, `076513d`, `64aa79e` |
| Production deployment | Not performed |
| Android signed artifact | Existing candidate superseded; no replacement built |
| Play upload | Not performed |

## Included source changes

- Default-off, browser-session-bound mobile authorization with same-origin,
  bounded-form, rate-limit, and reauthentication controls.
- Stable mobile-device ownership and failure-safe local session/cache purge.
- Centralized bounded maintenance for authorization/session/receipt retention.
- Typed mobile cache invalidation, selected offline collections, indexed
  eviction, canonical mobile routes, and architecture guardrails.
- Hash-bound migration risk records and fresh all-migrations rehearsal.
- Canonical Android candidate manifest/delta verification showing the old AAB
  as superseded.
- Off-host backup acknowledgement checksums and read-only pruning eligibility.
- Playwright isolated-port host-validation fix and passing public smoke.

## Required before production deployment

1. Exact-commit remote CI must pass.
2. Capture fresh production backup evidence ID, table/index sizes, lock waits,
   and active transactions for the two flagged migration reports.
3. Complete the owner-run trusted-ingress proof and production readiness/login
   checks.
4. Provide exact owner approval: `DEPLOY <short-sha>`.

## Required before Android or Play action

1. Confirm Play developer account/package ownership and choose signing identity.
2. Build a replacement AAB and record its source SHA, EAS build ID, checksum,
   version code, target SDK, package, and certificate fingerprint.
3. Deploy matching App Links through separately approved website release and
   run the signed-device smoke plan.
4. Complete owner/legal Data Safety, privacy/deletion, listing, tester, and
   exact-track approval steps.

## Excluded

No secret, signature, EAS, Play, production database, backup, OVH, Cloudflare,
or public endpoint operation was performed.
