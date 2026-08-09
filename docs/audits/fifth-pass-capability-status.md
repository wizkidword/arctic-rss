# Fifth-pass capability status

**Last reviewed:** 2026-08-09  
**Baseline:** `686cd18b7e7f6196865af34c93496c3bddf16a69`  
**Production status:** source review and local verification only; not deployed
or operator-verified.

| Finding ID | Source implementation | Unit/integration coverage | Browser evidence | Redis/PostgreSQL/Compose evidence | Migration required | Production release status | Operator verification | Mobile dependency | Remaining owner gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FP-001 | Not started | Existing browser/chat freshness only; worker-boundary coverage absent | Not run this pass | Not applicable until policy tests are added | No for initial policy slice | Not deployed | No | Required before device sessions | None for local source work; release remains `DEPLOY <short-sha>` gated |
| FP-002 | Not started | No fenced replay test | Not run | Real PostgreSQL replay fixture pending | Yes | Not deployed | No | None | Migration evidence and release approval |
| FP-003 | Not started | No fenced stale-reclaim test | Not run | Real PostgreSQL reclaim fixture pending | Yes | Not deployed | No | None | Migration evidence and release approval |
| FP-004 | Not started | Publisher-only fault injection pending | Not run | Redis/readiness fault injection pending | No | Not deployed | No | None | Release approval after evidence |
| FP-005 | Existing byte limit; fixed identity not started | Existing parser-limit tests; database boundary pending | Not run | PostgreSQL migration/backfill test pending | Yes | Not deployed | No | None | Migration evidence and release approval |
| FP-006 | Not started | Hostile publisher-text/date tests pending | Not run | Database text-boundary test pending | Possibly | Not deployed | No | None | Release approval after evidence |
| FP-007 | Not started | Changed-only persistence exists; generation race test absent | Not run | Real PostgreSQL order test pending | Yes | Not deployed | No | None | Migration evidence and release approval |
| FP-008 | Existing fourth-pass fix requires revalidation | Regression fixture pending | Not run | PostgreSQL test if query semantics change | No expected | Not deployed | No | None | Release approval only if changed |
| FP-009 | Existing reader projections require measurement | Shell benchmark pending | Authenticated payload capture pending | Query measurement pending | No expected | Not deployed | No | Mobile read API depends on stable projection | None for measurement |
| FP-010 | Static boundary checks pass; runtime proof pending | ACL/role negative tests pending | Not run | Compose and disposable Redis/PostgreSQL evidence pending | No expected | Not deployed | No | Required before mobile API exposure | Credential rollout and release approval |
