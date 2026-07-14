# Arctic IRC product specification

## Purpose

Arctic IRC is an account-based, browser-first chat experience within Arctic RSS. It should borrow the compact, keyboard-friendly interaction model of classic IRC without claiming native IRC protocol compatibility for Arctic-owned rooms.

The differentiator is discovery: native rooms are organized by the same canonical Discover interests and feed catalog that Arctic RSS already maintains. Article discussions happen in stable topic rooms; an article must never create its own room.

## Product boundaries

There are two deliberately separate domains:

1. **Arctic Network** is native chat. It uses Arctic accounts, durable PostgreSQL history, Arctic moderation, and room discovery.
2. **External IRC** is a later, separately flagged outbound-client/bouncer integration for an allowlisted set of third-party networks. Its identities, credentials, messages, buffers, rules, and moderation must not be represented as Arctic users or `ChatMessage` records.

The first implementation is native chat only. Arctic rooms are IRC-inspired web rooms, not an inbound IRC server. The optional external connector and an optional future inbound IRC/IRCv3 gateway are independent later work.

## MVP behaviour

- Existing verified Arctic RSS users can create one stable chat handle and enter official public rooms.
- Users can discover, join, leave, read recent history, receive live messages, and see approximate presence.
- The client provides room tabs, status notices, a member list, keyboard navigation, responsive drawers, and familiar typed slash commands.
- Users can share an existing Arctic RSS article into a joined room as a compact internal reference and optional comment.
- Operators and administrators can apply room controls; users can block and report abuse; all privileged actions are auditable.
- Chat stays completely unavailable unless `ARCTIC_IRC_ENABLED` is true. Failure of chat or its gateway must not affect the reader.

## Explicit initial exclusions

- User-created rooms, native direct messages, file transfer, voice/video, reactions, threads, raw HTML messages, arbitrary IRC hosts, channel bridging, and public third-party transcript archives.
- Automatic feed-to-room posting remains disabled until a separate flagged integration phase.
- External IRC is not started until a network-policy record and connection-architecture spike are complete.

## Repository-specific taxonomy decision

Arctic RSS does not currently persist a general `Interest` or `Topic` model. The canonical interest IDs are derived from `src/lib/discover-interests.ts`, which maps the composed Discover directory to stable IDs such as `ai`, `programming`, and `science`.

Therefore the native chat room-to-interest link will store a validated canonical interest ID string. Validation and labels will reuse `getDiscoverDirectory`, `createDiscoverInterestGroups`, and `getDiscoverInterestId`; it will not introduce a second topic table. Feed links can use the existing `Feed` primary key and article links can use the existing `Article` primary key.

## Delivery order

1. Phase 0: repository mapping and security/testing design (this documentation set).
2. Phase 1: additive native-chat schema, flags, normalization, permissions, and idempotent official-room bootstrap. No user-facing routes yet.
3. Phase 2: profile onboarding and authenticated gateway skeleton.
4. Phase 3 onward: rooms/messages, client shell, commands, discovery, article sharing, moderation, then privacy/operations.
5. External IRC only after native chat is proven and its separate policy/architecture gate is passed.

Every phase must preserve the existing reader, use additive migrations, keep secrets out of output, and avoid deployment, DNS, remote access, or pushes unless explicitly authorized.
