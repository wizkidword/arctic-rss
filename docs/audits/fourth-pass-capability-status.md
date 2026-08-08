# Fourth-pass capability status

**Last reviewed:** 2026-08-08
**Baseline commit:** `10896e19aa2a2151edff1bf550f0b3e56fcfe27e`

This is a source and verification ledger, not a deployment record. A source
change, test result, or merged commit does not claim that the capability is
released or operator-verified. All production columns remain `No` until a
separately approved release and post-release verification occur.

| Finding or capability | Source implementation status | Unit/integration coverage | Browser coverage | Compose/fault-injection coverage | Migration required | Production release status | Operator verification status | Remaining owner gate | Last reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terminal feed and podcast refresh jobs release their deterministic source IDs | Implemented in source; terminal source jobs remove on failure and retain compact failure evidence | Queue-option, readiness, and source-failure tests | Not applicable | Real local Redis lifecycle tests cover terminal failure, re-enqueue after worker restart, and concurrent deduplication | No | No | No | Review and approve a future release | 2026-08-08 |
| Durable Redis heartbeat and maintenance recovery | Implemented in source: shared bounded reconnect control plane, fail-closed lease loss, gated local heartbeat, and nonzero shutdown request after a bounded recovery grace | State, grace, shutdown, heartbeat gating, lease ownership, later-tick, and no-release-after-loss tests | Not applicable | Real disposable Redis restart test passes; Compose topology restart gate is added to CI but awaits CI execution | No | No | No | Review and approve a future release | 2026-08-08 |
| Manual and fallback source refreshes use BullMQ rather than the web process | Baseline finding confirmed; web actions still invoke refresh work directly | Existing action tests do not enforce workload placement | Not yet required | Queue result contract pending Phase 3 | No | No | No | Review and approve a future release | 2026-08-08 |
| Account-deletion handoff rate-limit order | Baseline finding confirmed; signature derivation precedes rate limiting | Existing handoff/route tests cover behavior, not cost ordering | Not applicable | Abuse timing fixture pending Phase 4 | No | No | No | Review and approve a future release | 2026-08-08 |
| Feed, podcast, XML, and discovery resource budgets | Baseline finding confirmed; item, field, aggregate, and total-time budgets are incomplete | Existing parser tests lack hostile aggregate fixtures | Not applicable | Hostile fixture and timing coverage pending Phase 5 | No | No | No | Review and approve a future release | 2026-08-08 |
| Changed-only feed and podcast persistence | Baseline finding confirmed; existing source items are updated without a content fingerprint | Existing batch tests cover batching, not no-op persistence | Not applicable | Disposable PostgreSQL statement counts pending Phase 6 | Yes — expand-only fingerprint fields | No | No | Migration evidence and release approval | 2026-08-08 |
| One-active OPML import per user | Baseline finding confirmed; check-then-create is not database-enforced | Existing job tests do not provide an isolation-level race proof | Not applicable | Concurrent PostgreSQL test pending Phase 10B | Yes — partial unique index or equivalent | No | No | Migration evidence and release approval | 2026-08-08 |
| Current story versions selected before limiting | Baseline finding confirmed; historical versions are limited before current-version filtering | Existing reader tests do not cover historical crowd-out | Not applicable | Not applicable | No | No | No | Review and approve a future release | 2026-08-08 |
| Collection-retained article authorization | Baseline finding confirmed; list, detail, search, and state mutation do not share one durable access rule | Existing list/search tests do not cover post-unsubscribe lifecycle | Authenticated journey pending Phase 8C | Not applicable | No | No | No | Review and approve a future release | 2026-08-08 |
| Fourth-pass operational and product work | Not started; ordered behind Phases 1–10 | Not started | Not started | Not started | To be classified per change | No | No | Owner approval before Phase 11 product work | 2026-08-08 |

## Baseline evidence index

- Full locked local verification and the real-Redis queue reproduction are
  recorded in [fourth-pass-baseline.md](fourth-pass-baseline.md).
- The third-pass evidence remains in
  [third-pass-capability-status.md](third-pass-capability-status.md); it is
  independent evidence and does not close a fourth-pass finding.
- Production release and rollback rules remain owner-gated in
  [the CI/CD release gate](../operations/ci-cd-release-gate.md) and
  [the deployment rollback runbook](../operations/deployment-rollback-runbook.md).
