# Chat message sequence decision

## Decision

Keep the existing global `ChatMessage.sequence` as the durable message cursor.
Do not run a schema migration in this remediation pass.

The current sequence is a PostgreSQL `BIGSERIAL`, is unique across all chat
messages, and is indexed with `roomId` for history queries.  It is deliberately
serialized as a string at the HTTP and Socket.IO boundary.  A member's read
marker is derived server-side from a visible message in the requested room, not
accepted as a client-provided number.

This decision does **not** mean that a global sequence is a room-local event
counter.  In particular, a jump from `10` to `14` in one room may represent
three messages in other rooms.  Clients must treat the existing sequence-gap
check only as a best-effort recovery hint; it cannot prove that a room message
was missed.  A subscribe/reconnect snapshot remains the authoritative repair
path.

## Evaluation

| Concern | Current global cursor | Room-local cursor | Decision |
| --- | --- | --- | --- |
| Unread markers | Correct: the marker is verified against `roomId`, visibility, membership, and join time before its monotonic update. | Also correct, but no stronger authorization property. | Keep global. |
| Event-gap detection | A numerical gap is ambiguous across rooms, so it can cause an unnecessary repair fetch. It cannot be used as proof of a missed room event. | Gives an exact per-room continuity signal. | Do not use adjacency of the global number as a correctness assertion. Add a room-local event watermark only if exact live-gap repair becomes a product requirement. |
| Information leakage | A room member can infer that some other chat activity occurred from a numerical jump, but cannot learn its room, sender, content, or membership. | Removes this aggregate-activity side channel. | The limited side channel does not justify a cursor migration today; reconsider before private or membership-concealed rooms expand. |
| Retention | Retention is time-based and uses `createdAt`/`id` indexes, independent of message sequencing. Read-marker repair already clamps to visible messages. | No material benefit. | Keep global. |
| Pagination | `roomId, sequence` provides stable, index-backed, descending history pages. | Equivalent once a per-room unique index exists. | Keep global. |
| Partitioning and write throughput | A database sequence is cheap and has no per-room row lock. | Requires a serialized per-room counter allocation and a composite uniqueness constraint. It can help future room-based sharding. | Defer until capacity data or partitioning design requires it. |

## Correctness and privacy boundary

All history, snapshots, message sends, and read-marker updates are constrained
by the durable room membership checks.  The global sequence is never accepted
from a client as authority, and it cannot move a marker across rooms.  The
resulting numerical gaps are therefore a privacy-quality and recovery-efficiency
question, not an authorization bypass.

The UI recovery helper must not promise exact detection while it receives only
the global number.  Its value is limited to requesting a fresh authorized
snapshot when a gap looks suspicious.  Repeated snapshots are safe because the
server pages history by `roomId` and cursor under membership enforcement.

## Revisit triggers

Start a dedicated migration proposal only when one or more of these is true:

- Private or concealed rooms make aggregate cross-room activity leakage
  unacceptable.
- Product requirements need a reliable per-room live-event continuity signal.
- Measured database sequence contention or room-oriented partitioning becomes
  a material scaling constraint.
- A protocol version can be rolled out to every supported web and gateway
  client before the legacy cursor is retired.

## Safe future migration shape

If a trigger is met, add a nullable `roomSequence` beside the global sequence;
do not replace the existing field in place.

1. Add `ChatMessage.roomSequence` and the per-room allocator in an expand-only
   migration. Keep the global sequence and every existing cursor unchanged.
2. Dual-write new messages inside the existing message transaction. Allocate
   the room value atomically, then enforce `UNIQUE(roomId, roomSequence)` only
   after the backfill is complete.
3. Backfill old messages in room and global-sequence order while dual-writing
   new messages. Check for duplicates and nulls before enabling readers.
4. Version the wire contract so new clients receive both `sequence` (legacy
   stable cursor) and `roomSequence` (room continuity). Old clients continue
   using the global cursor during the mixed-version window.
5. Move snapshots, pagination, and live-gap repair to the room cursor only
   after every supported client and gateway understands the versioned payload.
   Retain the global cursor for legacy links, audit correlation, and rollback
   until its removal has separately been approved.

No production database, cursor, or chat protocol change is authorized by this
decision note.
