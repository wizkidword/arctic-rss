# Phase 10 — ArcticBot and feed events

## Scope

ArcticBot is a native Arctic room service account label, not a person and not
an IRC bridge. It never opens an external IRC connection and never posts to an
external channel.

This phase adds the following dormant pieces:

- a post-ingest boundary that returns only IDs confirmed as newly inserted;
- the `chat-article-integration` retry queue and worker;
- per-room/feed `OFF`, `LIVE`, and `DIGEST` settings;
- durable delivery records keyed by room and article;
- a database-backed per-room cooldown;
- local user hiding and an operator-authorized room-wide disable control.

The migration is deliberately created but must **not** be applied during local
development or production rollout until the staged deployment phase.

## Safety model

`refreshFeed` persists article data before it makes new article IDs available
to the worker. If an insert races another refresh, it emits no bot event rather
than risking a stale or duplicate post. Queue enqueue failure is logged as a
deferred integration event after feed refresh succeeds, so RSS parsing and
health tracking remain independent of chat availability.

Both `ARCTIC_IRC_ENABLED=true` and `ARCTIC_IRC_BOT_ENABLED=true` are required.
When either flag is false, the integration service returns before querying an
article, creating a delivery, or posting a message. Existing queued jobs repeat
that check, so turning the flag off is an immediate kill switch.

Only active official native rooms are eligible for `LIVE` or `DIGEST` posting.
`OFF` is the default. An operator may only attach a feed they subscribe to.

## Message behavior

- `LIVE` records a pending delivery and posts one compact `BOT` article card
  when the room cooldown allows it.
- `DIGEST` records pending deliveries and posts at most five titles in one
  compact `BOT` message when the room cooldown allows it.
- The cooldown is between 1 and 1,440 minutes and applies across all automated
  feeds in a room.
- `ChatBotDelivery(roomId, articleId)` is the durable deduplication key.
- Bot messages contain titles and compact article references only. They never
  include full article bodies or raw feed content.

The IRC shell renders the sender as `<ArcticBot>` and labels automated cards.
Each user can select **Hide ArcticBot**; that preference is local to the shell.
The **Disable ArcticBot** room action is server-authorized and switches every
active room feed to `OFF` while discarding undelivered pending posts;
non-operators receive a permission error.

## Operator API, not yet enabled

All endpoints require normal chat eligibility and respect the existing chat
moderation rate limit. The endpoint is unavailable while chat itself is off.

`GET /api/chat/rooms/:slug/bot`

Lists room/feed settings to an authorized room operator or administrator.

`PUT /api/chat/rooms/:slug/bot`

Example request body:

```json
{
  "feedId": "existing-feed-id",
  "postingMode": "DIGEST",
  "minimumIntervalMinutes": 60
}
```

`POST /api/chat/rooms/:slug/bot`

```json
{ "action": "disable" }
```

Every configuration and disable action writes a chat audit record.

## Deferred activation checklist

Do this only after the native chat beta is otherwise ready:

1. Review and apply the additive migration
   `20260714030000_add_arctic_bot_deliveries` during the normal migration
   window.
2. Keep `ARCTIC_IRC_BOT_ENABLED=false` through ordinary migration and smoke
   checks.
3. Choose one active official test room and one subscribed feed.
4. Configure that feed as `DIGEST` with at least a 60-minute interval.
5. Enable the bot flag only for that controlled test, observe the integration
   queue and room audit trail, and verify one compact post at most.
6. Exercise **Hide ArcticBot** as a regular user and **Disable ArcticBot** as a
   room operator.
7. Turn the flag back off at the first unexpected post, queue failure pattern,
   or moderation concern.

Do not enable ArcticBot in external IRC channels. External-network work remains
out of scope and separately owner-controlled.
