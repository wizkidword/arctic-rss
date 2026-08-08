# Legacy Redis compatibility retirement

## Status: owner-gated, not removed

The temporary `REDIS_URL` fallback and
`ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION` flag remain in source only as
a guarded direct-process compatibility path. Normal Compose services receive
the workload-specific `DURABLE_REDIS_URL` and `EPHEMERAL_REDIS_URL` values;
the exact service-role manifest and Compose validation do not inject
`REDIS_URL` into them.

The dormant `ops/compose/emergency-env-file.override.yml` is a separate,
owner-approved rollback-only compatibility file. It is not part of normal
Compose, CI, release, or rollback commands. It must not be used as a routine
configuration shortcut.

## Evidence and limit

The checked-in production inventory records a historical release observation,
not a live verification performed during this pass. This repository work did
not read the private production environment file, start containers, or alter
OVH. Therefore it cannot prove that the legacy variables are absent today, and
removing the fallback now could make an approved recovery path unavailable.

`npm run compatibility:verify-legacy-redis` makes the compatibility surface
explicit: it fails if either deprecated variable appears outside the documented
implementation, test, and historical-record files. Once retirement is
complete, reduce that allowlist to historical records only and delete the
runtime/configuration entries in the same change.

## Owner-gated removal checklist

The owner must first authorize a production-readiness check and the subsequent
approved release. Do not print any environment value while performing it.

1. On OVH, verify by variable name only that the root-only environment file has
   non-empty `DURABLE_REDIS_URL` and `EPHEMERAL_REDIS_URL`, and has no
   `REDIS_URL` or legacy-flag entry.
2. Run the scoped doctor/readiness procedure for the selected topology and
   confirm durable and ephemeral Redis identities remain intentionally
   separate.
3. Confirm at least one approved production release has completed and its web
   and selected worker roles are healthy without the compatibility path.
4. Obtain a fresh explicit owner approval for the compatibility-removal
   release. This is a source and production configuration change; it is not
   authorized by CI success alone.
5. In the approved removal change, delete the fallback code, flag, example
   variables, and runtime compatibility exception; remove the dormant broad
   `env_file` override after one further stable release confirms it is no
   longer needed.
6. Run the full release gate, deploy only through the approved immutable-image
   procedure, then verify public health, protected diagnostics, login, feed
   work, required heartbeats, and both Redis workload identities.

## Risk of deferral

The fallback is disabled by default in Compose and production rejects it unless
the explicit flag is present. Keeping it temporarily retains a small guarded
configuration surface; removing it without current OVH proof creates a higher
availability risk. The boundary check keeps that surface from spreading while
the owner-gated proof is pending.
