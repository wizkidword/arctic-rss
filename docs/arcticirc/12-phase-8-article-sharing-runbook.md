# Arctic IRC Phase 8 article sharing runbook

## Scope

This phase connects an owned Reader article to a native Arctic IRC room without
copying the article body, original URL, subscription list, folder, or any other
private Reader state into chat.

No new content model or migration is needed: `ChatMessage.ARTICLE` and its
existing optional `articleId` relation hold one compact share record.

## User flow

1. When `ARCTIC_IRC_ENABLED=true`, an article detail page shows **Discuss in Chat**.
2. The dialog ranks active public rooms using the article feed's canonical
   Discover category. Only public room metadata reaches the browser.
3. The user explicitly chooses **Join & share**. The application joins that
   open room, then creates one typed `ARTICLE` message.
4. The chat transcript renders an internal article card with title and
   publisher. Its link returns to the Reader article and still enforces Reader
   ownership.

The direct post API is `POST /api/chat/rooms/:slug/articles`. It requires an
eligible Arctic account, active room membership, a current subscription to the
article's feed, valid client idempotency input, and the shared chat rate limit.

## Data and privacy contract

Persisted ARTICLE messages contain only:

- the durable `articleId` relation;
- the clipped article title as the constrained chat body;
- a version-only metadata object (`{ v: 1 }`);
- existing sender, room, sequence, and audit timestamps.

The serialized wire card contains only article ID, title, and feed title
(publisher). It never includes article URL, HTML, plain-text content, summary,
feed URL, subscription state, collection, or Reader preferences.

Re-sharing the same article to the same room by the same user is rejected for
one hour. Client-message idempotency remains safe across retries.

## Realtime delivery

After durable creation, the route publishes the already-sanitized message wire
record to the internal Redis `arctic-rss:chat:room-events:v1` channel. The
gateway uses a dedicated Redis subscriber and emits it only to the matching
native room socket namespace. Browser clients de-duplicate messages by durable
message ID.

Redis event payloads are internal-only and contain the same compact wire card;
they do not carry source article content or credentials. A publish failure
returns an error after persistence, so retrying with the same client message
ID can safely re-attempt delivery.

## Verification

Run locally without enabling chat, applying migrations, starting Docker, or
contacting any external IRC network:

```powershell
npm run prisma:generate
npm test
npm run lint
npm run typecheck
npm run build
```

For a later isolated staging check, after the separately approved migration and
room bootstrap, use two authenticated browser sessions:

1. Subscribe session A to a feed and open one of its article detail pages.
2. Choose an interest-matched room and confirm **Join & share**.
3. Verify session B, already joined to that same room, receives one card in
   realtime; a different room receives none.
4. Verify the card contains title and publisher only, and its internal Reader
   link remains unavailable to a user without that article subscription.
5. Retry the request with the same client message ID, then try a new ID during
   the one-hour window; confirm no duplicate durable share is created.

Keep `ARCTIC_IRC_ENABLED=false` outside that controlled environment. This phase
does not alter external IRC policy, service exposure, Docker profiles,
reverse-proxy routing, migrations, room bootstrap, or production configuration.
