# Sixth-pass Phase 9: bounded reader and search pagination

**Status:** initial source slice verified locally; the broader alpha scope
remains in progress.

The reader and search screens now use one owner-scoped mobile pagination hook.
Each initial page and subsequent page is cancelled when it becomes obsolete,
deduplicated by stable item ID without reordering existing results, and merged
to a hard maximum of 300 metadata-only list items. A page beyond that bound is
not fetched indefinitely; the UI explains that the user should refine the
view. Pull-to-refresh resets to the first cursor, a normal terminal cursor
shows an explicit end state, and failed later pages retain the already valid
cached items.

The merged page is stored through the existing bounded offline cache and is
only rendered for the current authenticated owner and query key. The
foreground sync revision reloads visible paginated views, and generation plus
abort guards prevent an old search or reader response from replacing a newer
one.

Focused merge tests cover stable duplicate suppression and the item cap. Root
and mobile typecheck, mobile lint, and Android export pass for this slice.
Saved-view, briefing, collection, and any retained-podcast pagination remain
separate follow-up work; no podcast ship/remove decision, offline-download
expansion, signed build, or Play action is implied.

The notification picker also no longer offers `MOBILE_PUSH`: there is no
provider, permission flow, device-token registration, or delivery evidence in
this alpha. Existing server-side push preferences remain visible only as
unavailable and can be changed to an implemented channel.
