# Arctic RSS Phase 1 — Service-specific secret isolation

## Phase 1 — Enforce service-specific secret isolation

### Status

Complete for source, Compose, and local validation. No production deployment
or configuration mutation was performed.

### Baseline

- Starting Git SHA: `52b1512`.
- Relevant files: `docker-compose.yml`, `src/lib/production-security.ts`,
  `worker/index.ts`, and `services/chat-gateway/index.ts`.
- Confirmed finding: `migrate`, `web`, `worker`/split workers, and
  `chat-gateway` inherited the full `.env` through `env_file`.

### Changes implemented

- Replaced all application-service `env_file` entries with explicit Compose
  allowlists.
- Replaced split-worker inheritance with a runtime anchor plus per-role
  environment maps, so split workers do not inherit all-in-one secrets.
- Made production startup validation role-aware for web, every worker mode,
  and chat gateway; sensitive variables fail closed when present in the wrong
  service.
- Added a Compose-rendering verifier to CI and `npm run compose:verify-env`.
- Added the service secret matrix and a dormant, value-free emergency rollback
  override.

### Security impact

Web no longer receives migration, PostgreSQL-container, Redis-container, or
tunnel secrets. Split workers receive only the variables their responsibility
uses; chat gateway excludes web auth, mail, AI, migration, and tunnel secrets.
The Compose verifier uses `.env.example` only and proves the rendered
boundaries without reading production values.

### Operational impact

`.env` remains owner-only production configuration, but Compose now uses it
only for interpolation. Every new runtime variable must be added deliberately
to the smallest service allowlist and the secret matrix. The existing
all-in-one topology is unchanged; Phase 2 will make worker ownership
exclusive.

### Database/migration impact

None. The migration container receives only `DATABASE_URL`, interpolated from
`MIGRATE_DATABASE_URL`; no Prisma schema or migration changed.

### Tests and commands run

- `node node_modules/vitest/vitest.mjs run src/lib/production-security.test.ts services/chat-gateway/index.test.ts worker/mode.test.ts` — 16 passed.
- `node scripts/ci/assert-compose-service-environments.mjs` — passed.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `node node_modules/vitest/vitest.mjs run` — 1,054 passed, 3 skipped.
- `node node_modules/eslint/bin/eslint.js .` — no errors; two pre-existing warnings.
- `node node_modules/next/dist/bin/next build` — passed.

### Evidence

- `docker-compose.yml` has no application-service `env_file` or split-worker
  `extends` relationship.
- `scripts/ci/assert-compose-service-environments.mjs` renders chat,
  split-worker, and tunnel profiles and verifies sensitive values are absent.
- `.github/workflows/ci.yml` runs `npm run compose:verify-env` in the existing
  Compose/container-security gate.
- `docs/operations/service-secret-matrix.md` records configuration ownership,
  rotation impact, and the procedure for adding a variable.

### Remaining risks

- The emergency override restores broad injection only when an owner explicitly
  passes it to Compose; remove it after one stable allowlisted release.
- The default topology still permits all-in-one plus split workers to start
  together. Phase 2 must make topology selection exclusive before a split
  rollout.
- Production rollout remains separately approval-gated and needs fresh backup,
  runtime, and migration evidence.

### Rollback

Revert this phase's commit to return to the prior configuration, or use
`ops/compose/emergency-env-file.override.yml` only for an owner-approved
emergency compatibility rollback. The override contains no values and is not
used by CI or normal releases.

### Next phase gate

Pass. Phase 2 may establish the canonical topology manifest and reject
simultaneous worker ownership.
