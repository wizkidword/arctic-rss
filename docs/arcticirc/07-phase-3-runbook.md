# Arctic IRC Phase 3 runbook

## Native room APIs

All endpoints remain unavailable unless `ARCTIC_IRC_ENABLED=true`, require a current verified Arctic RSS account, and return `Cache-Control: no-store`.

- `GET /api/chat/rooms` lists active public rooms.
- `GET /api/chat/rooms/:slug?before=<sequence>&limit=<1-100>` returns an active member's room snapshot and chronological history page.
- `POST /api/chat/rooms/:slug/membership` joins an open, non-banned room.
- `DELETE /api/chat/rooms/:slug/membership` leaves the room.

Joining, leaving, history access, message sends, and read markers are re-authorized against durable membership records. The service does not trust a client-side room tab or socket-room name as authority.

## Gateway events

After the Phase 2 authenticated handshake, the native gateway supports these internal event contracts:

- `room:subscribe { slug }` returns a room snapshot and joins the socket to a server-owned room channel.
- `room:unsubscribe { roomId }` removes that socket from the live room channel.
- `room:message { roomId, clientMessageId, body }` persists a plain-text message, emits it only to authorized subscribers, and acknowledges whether the write was new or an idempotent retry.
- `room:read { roomId, sequence }` advances the durable read marker only.

`clientMessageId` is unique per sender. Retrying the same ID in the same room returns the original message; using it for another room is rejected. Sequence values are represented as strings over JSON so no JavaScript `BigInt` is serialized directly.

## Redis use

Redis stores only transient concerns: the Socket.IO adapter, message-send rate-limit counters, one-time connection-token records, and per-socket presence keys with a 75-second TTL. PostgreSQL remains authoritative for rooms, members, messages, history, and read markers.

## Manual private-environment verification

After the additive migration and official-room bootstrap are applied in a non-production environment:

1. Create two verified chat profiles and join both accounts to `#ai`.
2. Obtain separate session tokens and connect both clients through the canonical WSS route.
3. Subscribe both clients to `#ai`; send a text message with a generated `clientMessageId` from the first client.
4. Confirm the second client receives exactly one `room:message` event.
5. Retry the same event with the same `clientMessageId`; confirm the acknowledgement says `created: false` and no second broadcast occurs.
6. Disconnect and reconnect a client, then subscribe again; confirm the history snapshot includes the durable message.
7. Try room history and sending as a non-member, and confirm both are rejected.
8. Confirm the 31st message inside one minute is rate-limited, then confirm ordinary Reader pages still work with the `chat` Docker profile stopped.
