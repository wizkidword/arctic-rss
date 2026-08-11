# Sixth-pass Phase 6: durable offline queue and conflicts

## Implemented source slice

The mobile queue now keeps explicit state rather than deleting every
non-network replay failure. It records account/device ownership, local and
idempotency IDs, operation/resource identity, bounded payload, attempts,
bounded error code, timestamps, backoff, and optional expected-version field.
Claiming a replay changes it to `SENDING` inside an exclusive SQLite
transaction; receiving a response marks it `COMPLETED`; terminal failures
remain visible until the owner retries or discards them.

Version 2 of the alpha SQLite schema validates and upgrades owned version-1
queue rows. Invalid, mismatched, or ownerless legacy rows are removed rather
than attributed to another signed-in account. The existing owner switch/purge
boundary remains authoritative.

The first conflict inbox is reachable from Settings. It uses fixed
human-readable labels/reasons, never raw error strings or queue payload, and
offers Retry, Open item, and explicit Discard actions.

## Verification boundary

- Pure queue-state tests cover ownership metadata, retry backoff, terminal
  retry, completed records, and invalid collection scope.
- Replay tests cover successful receipt, retryable network failure, missing
  resources, idempotency-key reuse, and authentication failure.
- Submit tests cover retryable service failures being queued and permanent
  responses staying out of the queue.
- Mobile typecheck and lint pass locally. Native SQLite upgrade/failure
  injection and disposable end-to-end lost-response/refresh evidence remain
  CI or device work.

No service request was sent, no SQLite database was opened, and no production,
deployment, Play, signing, or push action occurred in this worktree.
