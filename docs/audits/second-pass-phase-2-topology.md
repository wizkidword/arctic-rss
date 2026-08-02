# Arctic RSS Phase 2 — Canonical deployment topology

## Phase 2 — Establish one canonical deployment topology and correct CI

### Status

Partially complete. The canonical topology model, explicit Compose activation,
CI matrix, validation, operator documentation, and approval-gated release
selection are implemented and locally verified. A companion deterministic
rollback command still needs to consume the manifest's rollback list before
this phase can be closed.

### Baseline

- Starting Git SHA: `475219d`.
- Relevant files: `docker-compose.yml`, `.github/workflows/ci.yml`,
  `scripts/windows/deploy-approved-release.ps1`, and deployment documentation.
- Confirmed finding: the all-in-one worker was unprofiled, so the existing CI
  chat job started it together with `split-workers`.

### Changes implemented

- Added `ops/topologies.json` as the canonical definition of all-in-one,
  all-in-one-with-chat, split, split-with-chat, and the optional tunnel
  overlay.
- Added manifest validation, Compose service-name validation, a topology-aware
  Compose wrapper for CI, and a running-service ownership assertion.
- Put `worker` behind the explicit `all-in-one` profile and moved
  `worker-chat-events` behind `chat-workers`.
- Changed the chat CI job to a two-topology matrix. Each job starts its own
  selected profile set and rejects an unexpected worker service.
- Made `deploy-approved-release.ps1` require a named topology, validate it
  locally, build only its application images, recreate its complete release
  list, remove stale application workers/chat services, and record its
  selected service health without changing its backup, off-host build, or
  `DEPLOY <short-sha>` gates.
- Updated deployment, rollback, project, README, topology, and roadmap
  documentation to reflect explicit selection and completed publisher-supplied
  transcript work.

### Security impact

An accidental `--profile split-workers` activation can no longer also start the
all-in-one worker. Chat-event ownership is absent from non-chat split topology.
The validator uses `.env.example` only and does not read production values.

### Operational impact

`docker compose up` no longer starts an application worker by default. Local,
CI, and the owner-approved release command must select a named topology.
`npm run topology:validate` verifies the manifest against rendered Compose
services before a topology change. The release record now identifies the
selected topology and redacted selected-service health results.

### Database/migration impact

None. `migrate` remains unprofiled and is required by every declared topology.

### Tests and commands run

- `npm run topology:validate` — passed for all four topologies.
- `npm run compose:verify-env` — passed after profile changes.
- Rendered all-in-one and split-with-chat service lists using `.env.example` —
  all-in-one includes only `worker`; split-with-chat includes only the five
  split workers.
- Focused topology, Compose, and chat-gate Vitest suite — 12 passed.
- `npm run typecheck` — passed.
- `npm test` — 1,060 passed, 3 skipped.
- `npm run lint` — no errors; two pre-existing unused-argument warnings in
  `src/app/app/actions.ts`.
- Focused `deploy-approved-release` and topology tests — 14 passed.
- PowerShell parser check and Git Bash `-n` check of the normalized embedded
  remote script — passed.

### Evidence

- `ops/topologies.json`
- `ops/topology-manifest.mjs`
- `scripts/ci/validate-topology.mjs`
- `scripts/ci/compose-topology.mjs`
- `scripts/ci/assert-running-topology.mjs`
- `scripts/windows/deploy-approved-release.ps1`
- `.github/workflows/ci.yml`
- `docs/operations/deployment-topologies.md`

### Remaining risks

- A companion approval-gated rollback command must consume the manifest's
  `rollbackServices` list and selected prior image tags before a split
  production rollback can be claimed deterministic.
- CI topology jobs will run on the next pushed commit; local validation did not
  start the full production-like application topology.
- Production topology selection and rollout remain separately owner-approved.

### Rollback

Revert this sub-milestone to restore the earlier profile behavior. For a
configuration-only rollback, select `all-in-one` explicitly; do not combine it
with a split-worker profile.

### Next phase gate

Fail. Complete manifest-driven rollback selection, then verify the CI topology
matrix on a pushed commit before closing Phase 2 or beginning Phase 3.
