# Third-pass capability status

**Last reviewed:** 2026-08-08

This is a source and verification ledger, not a deployment record. `No` in a
production column means this work did not release or verify that capability; it
does not infer the state of an earlier production release.

| Capability | Implemented in source | Covered by unit/integration tests | Covered by browser tests | Released to production | Operator-verified | Remaining work | Last reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Narrow related-story projection and inline coverage | Yes | Yes — reader/projection regressions in the full suite | Partial — public smoke only; no authenticated reader journey in this run | No — owner-gated | No | Fresh authenticated and production smoke after release | 2026-08-08 |
| Reader shell and mobile navigation islands | Yes | Yes — component and shell tests | Yes — public navigation/liveness smoke | No — owner-gated | No | Authenticated shell measurement at 10/100/200 feeds | 2026-08-08 |
| Cached public health and protected detailed health | Yes | Yes — health, cache, and authorization tests | No dedicated browser test in this run | No — owner-gated | No | Run public and admin health checks in selected production topology | 2026-08-08 |
| Scoped doctor and worker heartbeat diagnostics | Yes | Yes — doctor exit semantics and worker tests | Not applicable | No — owner-gated | No | Run enforcing doctor scopes against the selected host | 2026-08-08 |
| Migration-risk classifier and report gate | Yes | Yes — script/report coverage and CI wiring | Not applicable | No release performed | No | CI and a reviewed release commit; no migration added in this pass | 2026-08-08 |
| Service-role environment manifest and Compose boundary check | Yes | Yes — manifest and CI environment tests | Not applicable | No release performed | No | Execute against selected production topology only with owner approval | 2026-08-08 |
| Cross-device deletion handoff and one-active-token guard | Yes | Yes — action and concurrency coverage | No dedicated browser journey in this run | No — owner-gated | No | Authenticated cross-device acceptance journey after release | 2026-08-08 |
| Source attention, retry/pause, and bounded unsubscribe handoff | Yes | Yes — authorization, selection, and confirmation tests | No dedicated browser journey in this run | No — owner-gated | No | Authenticated user-flow and operator review | 2026-08-08 |
| Saved-search to Smart Digest draft handoff | Yes | Yes — saved search and Smart Digest form coverage | No dedicated browser journey in this run | No — owner-gated | No | Authenticated browser journey and product acceptance | 2026-08-08 |
| AI provenance wording for summaries, digests, and related coverage | Yes | Yes — rendered component/source regressions in full suite | Partial — public smoke does not exercise signed-in AI | No — owner-gated | No | Authenticated AI flow and cost/usage observation after release | 2026-08-08 |
| Action, article, reader, and worker responsibility splits | Yes | Yes — full regression suite, typecheck, lint, and build | Indirect — public smoke after build | No release performed | No | Continue normal regression coverage; no behavior change intended | 2026-08-08 |
| Search privacy-safe metrics and query-plan evidence | Yes | Yes — focused search telemetry tests | Not applicable | No — owner-gated | No | Fresh synthetic plan run on compatible disposable Linux Docker; observe metrics after release | 2026-08-08 |

The exact release gate, deployment approval boundary, and required post-release
checks remain in [the CI/CD release gate](../operations/ci-cd-release-gate.md)
and [the deployment rollback runbook](../operations/deployment-rollback-runbook.md).
