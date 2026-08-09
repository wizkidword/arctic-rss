# Source orphan lifecycle

## Current policy: report only

The first source-orphan release is intentionally non-destructive. Run:

```text
npm run sources:orphan-report
```

Its report payload is one compact JSON object with aggregate counts only.
Normal runtime connection telemetry may accompany that payload. Neither output
lists source URLs, source IDs, article titles, user IDs, or content, and the
command does not create, update, mark, or delete database records.

An orphan is currently a feed or podcast with no subscription rows. Because
this initial release does not add an `orphanedAt` state, the report's
`oldestOrphanSourceCreatedAt` is the oldest source creation timestamp among
currently unreferenced sources. It is not a claim about when a source became
orphaned.

## Report coverage

For unreferenced feeds, the report includes article count, a tuple-size-based
source-content byte estimate, the oldest available source timestamp, and the
following references that a later purge must review or protect:

- collection items;
- static and dynamic discover-directory entries;
- chat-room feed configuration, bot deliveries, and article messages;
- audit-log references and active legal holds tied to those chat messages;
- article state, AI-summary, AI-digest, smart-digest, and story-cluster rows.

For unreferenced podcasts, it includes episode count, the same byte-estimate
method, oldest available source timestamp, collection items, and episode state.
The estimate covers the `Feed`/`Article` or `Podcast`/`PodcastEpisode` row
tuples only; it intentionally excludes shared indexes, database overhead, and
remote audio or image assets.

## Grace period and future purge boundary

The defined grace period is **60 days**, inside the approved 30–90 day planning
range. It is policy metadata only in this release: no source gets an orphaned
timestamp and no purge is enabled.

A future destructive release requires separate owner approval and must first:

1. record and clear an `orphanedAt` state correctly;
2. protect collection-retained content and all reported durable references;
3. delete only bounded, resumable batches with a dry-run mode;
4. stop immediately if the distributed maintenance lease is lost; and
5. record affected counts and duration without logging source or user data.

The report is a measurement tool, not authorization to remove sources.
