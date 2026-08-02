# Arctic RSS Phase 4A — Redis workload separation

## Status

Complete locally; not deployed. This sub-milestone starts from `043b771`,
after Phase 3 passed its local and CI gates. No production environment file,
host, Redis instance, or deployment command was accessed.

## Finding addressed

The application selected workload-specific Redis URLs when present, but could
silently fall back to `REDIS_URL` and had no production-time check that durable
and ephemeral workloads identified separate Redis targets.

## Implementation

- Production configuration now requires a workload-specific Redis URL. A
  `REDIS_URL` fallback is rejected unless
  `ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION=true` is explicitly set.
- The central web startup and all-in-one worker validate both URLs. Every
  declared topology includes `web` and already requires both variables in its
  manifest, so every selected deployment is checked without adding an unused
  ephemeral endpoint to the purpose-limited ingestion, imports, AI/mail, and
  maintenance workers.
- The comparison normalizes protocol (and therefore `redis` versus `rediss`
  TLS mode), lower-cased hostname, default/explicit port, and logical Redis
  database. Production rejects matching normalized endpoints.
- The direct Redis client configuration also fails closed in production, which
  prevents an unvalidated fallback if a future caller bypasses the normal
  startup guard.
- `docker-compose.yml` keeps its existing required workload-specific
  substitutions. The temporary flag is passed only to `web` and the
  all-in-one worker, where it permits a reviewed temporary shared endpoint;
  `REDIS_URL` itself is not injected into application containers.

## Compatibility and removal

`REDIS_URL` is deprecated. A direct-process migration can use it only with the
explicit flag, while Compose releases must still provide both workload
variables. The compatibility flag is false by default. Remove both
`REDIS_URL` and `ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION` before Phase
5 begins.

## Verification

- `npm run typecheck` — passed.
- `npm run compose:verify-env` — passed; service secret boundaries remain
  intact.
- `npm run topology:validate` — passed for all four topologies.
- `npm run lint` — no errors; two pre-existing unused-argument warnings remain
  in `src/app/app/actions.ts`.
- `npm test` — 1,074 passed, 3 skipped.
- `npm run build` — passed.
- Focused Redis production-security/configuration tests — 17 passed. They
  cover missing workload URLs, legacy fallback without a flag, explicit
  migration compatibility, normalized host/default-port equivalence, distinct
  logical database numbers, TLS-mode distinction, and all-in-one validation.

## Rollback

Revert this sub-milestone to return to the former production fallback. Do not
set the compatibility flag as a substitute for a review; it intentionally
allows a single Redis target only during a documented temporary migration.

## Next phase gate

Pass locally. Phase 4B readiness and diagnostics can begin after this commit
is reviewed and published. Production rollout remains separately
approval-gated.
