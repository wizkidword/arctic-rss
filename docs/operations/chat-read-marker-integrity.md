# Chat read-marker integrity

Read markers are references to visible messages, not client-provided sequence
numbers. The gateway accepts `room:read` only with a `roomId` and `messageId`.
The service verifies active membership, room ownership, normal message
visibility, and (for `AFTER_JOIN` rooms) the membership join time before it
derives the sequence and advances the marker atomically.

Consequences:

- A future sequence cannot be forged by a client.
- A message from another room cannot advance this room's marker.
- A soft-deleted or retention-purged message cannot become a new marker.
- Existing markers remain monotonic; concurrent updates keep the larger valid
  sequence.

## Repair command

Use the repair only after the normal backup gate. It scans in bounded pages,
reports counts only, and is safe to rerun. First run a dry run from the active
release without printing `.env` values:

```bash
cd "$APP_DIR"
docker compose run --rm --no-deps worker \
  node repair-chat-read-markers.mjs --dry-run
```

After reviewing the sanitized count and confirming a PostgreSQL backup, run the
repair with its deliberate literal confirmation:

```bash
docker compose run --rm --no-deps \
  -e ARCTIC_IRC_REPAIR_READ_MARKERS_CONFIRM=REPAIR \
  worker node repair-chat-read-markers.mjs
```

The repair clamps a marker above the latest visible message in its room. If no
visible messages remain, it clears that marker to `null`. It uses a conditional
update so a simultaneous valid read update is never overwritten by an older
repair observation. Record only the completion counts and commit in the change
ticket; do not export member, room, or message identifiers.

## Rollback

The protocol and repair add no schema migration. A code rollback is safe, but
do not try to reconstruct a marker from a purged message. Forward repair with a
current visible message is the correct recovery path.
