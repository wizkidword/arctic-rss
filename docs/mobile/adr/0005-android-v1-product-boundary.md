# ADR 0005: bounded Android v1 product surface

**Status:** accepted for sixth-pass source work.

## Decision

Android v1 contains sign-in; All, Unread, and Starred reader views; article
detail/state actions; search; saved views; collections; deliberately selected
offline content; briefings; and account, device, privacy, and deletion
surfaces. Notification preferences appear only for real delivery channels.

Advanced source administration, OPML, story merge/split, administration,
external IRC, and broad AI configuration remain web-only. Before internal
testing, the owner must choose either a real native podcast player with
background/MediaSession behavior or removal of podcast playback controls.

## Rationale and consequences

The alpha must be a trustworthy reader, not a partial clone of every web
feature. Deferred features cannot remain as misleading navigation or inactive
controls.
