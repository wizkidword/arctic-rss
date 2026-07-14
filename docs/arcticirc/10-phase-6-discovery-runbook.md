# Arctic IRC Phase 6 discovery runbook

`/irc/discover` is a feature-flagged public room directory. It returns only active public room metadata: name, slug, description, topic, official status, and the already-public room-interest tags.

For a signed-in reader, matching subscribed feed URLs are converted server-side into canonical Discover interest IDs and used only to sort the same public rooms. Feed URLs, subscription names, folders, and private match details are never included in rendered output or the public rooms API.

The directory is available from the IRC toolbar. Search uses `?q=` and matches room metadata only.

`GET /api/chat/rooms` now provides the same public metadata when chat is enabled; it neither requires nor reveals an Arctic account. History, membership, profiles, session tokens, and message APIs remain authenticated.

Manual verification requires migrated and bootstrapped rooms in a non-production environment. Do not enable chat, apply migrations, bootstrap rooms, configure a proxy, or start Docker services solely to verify this directory.
