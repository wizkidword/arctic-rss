# Arctic RSS Phase 3 — renewable maintenance lease

## Status

Complete locally; not deployed. This phase starts from `4884719`, after the
Phase 2 topology gate passed. No production host, data, or deployment command
was contacted.

## Finding addressed

`worker/maintenance-lock.ts` previously acquired a five-minute Redis `SET NX
PX` key and compare-and-deleted it at the end of the scheduler pass. A pass
that ran longer than five minutes could therefore overlap with another worker.

## Implementation

- Each acquisition creates a new UUID owner token and stores it with `SET NX
  PX`.
- While a pass is active, the worker renews roughly every third of the TTL.
  The renewal Lua script extends the TTL only if the Redis value still equals
  that pass's owner token.
- Release uses a separate compare-and-delete Lua script. A delayed or stale
  owner therefore cannot delete a lease acquired by a later worker.
- Any failed renewal or owner mismatch marks the in-process lease lost,
  aborts its signal, and exposes `assertHeld()` to the active scheduler pass.
  The worker checks the lease before and after each maintenance task, and
  before each further item in refresh, digest, email, chat-bot, retention,
  AI-reconciliation, and saved-monitor batch loops.
- Shutdown marks a running lease cancelled, stops renewal, attempts the same
  guarded release, then closes the Redis client. The normal shutdown runtime
  already waits for the scheduler pass before closing resources.

## Fencing decision and idempotency review

No additional monotonic fencing counter is introduced for this scheduler
lease. The pass schedules or performs resource-specific work; it does not
directly hold a long-lived external side-effect authority. The operations it
starts have existing durable guards:

- feed and podcast scheduling claim `nextFetchAt` with a conditional
  `updateMany`, and their BullMQ jobs use deterministic IDs;
- smart-digest and smart-digest-email queues also use deterministic job IDs;
- chat bot delivery serializes posting with a transactional conditional room
  update and marks deliveries `POSTED` in that transaction;
- retention and AI reconciliation each take their own transactional advisory
  lock, and saved monitors use a conditional time-bounded claim.

The renewable lease is therefore a scheduler ownership guard, while the
resource-level claim remains the fence for the underlying durable mutation.
If a future maintenance task performs a non-idempotent, externally visible
action directly from this pass, it must add a resource-specific monotonic
fencing token or an equivalent transactional/idempotency key before joining
the lease.

## Observability

The worker emits structured `worker_maintenance_lease` events for acquisition,
skips, renewals (including renewal latency), lease loss, completion, guarded
release, and release failure. Completion and release include lease/pass
duration and an `overrun` flag when duration exceeds the configured TTL.
Owner tokens are never logged.

## Verification

- `npm run typecheck` — passed.
- Focused ESLint for the changed worker and scheduler modules — passed.
- Focused Vitest suite — passed: 12 tests across maintenance lease and refresh
  scheduling.
- The lease tests cover an operation longer than its initial TTL, exclusion of
  a second worker after renewal, Redis-renewal interruption and cancellation,
  stale release after a newer acquisition, shutdown while holding a lease,
  and a two-worker acquisition race.

## Rollback

Revert this sub-milestone to restore the previous fixed five-minute lock. Do
not manually delete `arctic-rss:worker:maintenance-lock:v1`; the guarded
release is intentionally safe across current and stale owners.

## Next phase gate

Pass locally. The next planned phase may start after this commit is reviewed
and published; production rollout remains separately approval-gated.
