# Smart Digests Design

## Goal

Smart Digests let a reader turn their subscribed feeds into scheduled, topic-focused briefings. A reader can create a saved rule such as "Iran-U.S. conflict", choose which feeds Arctic RSS should watch, and receive a digest of matching articles both inside the app and by email.

Version 1 uses deterministic keyword and phrase matching. The data model and service boundaries should leave room for a later hybrid AI matching mode that can become part of a paid plan.

## Non-Goals

- Do not add semantic AI matching in version 1.
- Do not add paid billing in version 1.
- Do not summarize full article bodies with an AI model in version 1.
- Do not send instant email alerts for every matching article.

## User Experience

The AI area should become a broader digest workspace, with room for current article summaries, existing unread digests, and new Smart Digests.

The Smart Digest builder asks for:

- Digest name.
- Topic prompt shown to the user as a plain-language description.
- Include terms, supporting exact phrases and individual keywords.
- Exclude terms.
- Source scope: all active feeds, selected folders, or selected feeds.
- Delivery cadence: daily for version 1.
- Delivery channel: in-app archive, with optional email delivery.

Existing rules appear in a list with status, next run, last run, and recent match count. Each generated digest has a detail page similar to the existing AI digest detail page, with sections for matching articles, the reason each item matched, and links back to the original articles.

## Matching Rules

Version 1 matching is rule-based:

- Match against article title, feed title, article summary, and stored article text when available.
- Include terms are case-insensitive.
- Quoted phrases require an exact phrase match after whitespace normalization.
- Unquoted keywords match whole words when practical.
- Exclude terms remove an article even if it also matches include terms.
- A rule with no include terms is invalid.

Each match should record the matched terms and source fields so users can understand why an article appeared.

## Data Model

Add a Smart Digest rule model with:

- `id`, `userId`, `name`, `topicPrompt`.
- `matchingMode`, defaulting to `RULES`; reserve `HYBRID_AI` for later.
- `includeTerms`, `excludeTerms`.
- `sourceScope`, with values for all feeds, folders, or explicit feeds.
- `emailEnabled`, `cadence`, `scheduledHour`, `timeZone`.
- `lastRunAt`, `nextRunAt`, `lastMatchedAt`.
- `isEnabled`, `createdAt`, `updatedAt`.

Add join tables for selected folders and selected feed subscriptions. Add separate generated digest and digest item models for Smart Digests rather than overloading the existing `AiDigest` tables, because this feature can run without AI and needs email delivery state.

Each generated digest should store:

- Owning user and rule.
- Status: pending, processing, completed, failed, or completed with no matches.
- Delivery metadata: in-app created, email sent, email failed.
- Start and completion timestamps.
- Article count.

Each generated item should store:

- Article reference.
- Article title, URL, feed title, published date snapshot.
- Matched terms and match reason.
- Position.

## Backend Flow

The worker should run a scheduler alongside the existing feed, podcast, and AI digest schedulers.

On each scheduler tick:

1. Find enabled Smart Digest rules due to run.
2. Enqueue one job per due rule.
3. The job locks or advances `nextRunAt` to avoid duplicate sends.
4. Load candidate articles published or created since the previous run window.
5. Apply the rule matcher.
6. Create an in-app digest, even when no articles matched.
7. Send email if enabled and articles matched.
8. Record delivery status and failures without exposing secrets.

The first implementation can use daily cadence only. The scheduler should keep the cadence field flexible so weekly or custom schedules can be added later.

## Email

Email delivery should reuse the existing SMTP mail helper. The email should be concise:

- Digest name and date.
- Topic prompt.
- Matched article list grouped by feed title, then newest article first inside each feed.
- For each article: title, feed, published date, short excerpt or RSS summary, matched terms, and original link.
- Link to the in-app digest page.

If SMTP is not configured, production should record a failed delivery state. Development may log only safe non-secret diagnostics.

## Paid Feature Groundwork

Version 1 should add entitlement checks without requiring payment code:

- Free plan default: allow one enabled Smart Digest per user.
- Admin plan: no practical limit.
- Leave Pro plan constants ready for future use.
- Store `matchingMode` so paid users can later get `HYBRID_AI`.
- Reuse AI usage logging only when an AI matching mode is introduced. Rule-based v1 should not consume AI quota.

The UI should avoid promising paid upgrades until billing exists, but the backend should return clear limit errors that can later become upgrade prompts.

## Error Handling

- Invalid rules show form-level errors before saving.
- If a selected feed or folder is deleted, the rule should keep running with remaining sources.
- If no sources remain, the rule should pause or fail with a readable status.
- Email failures should not delete the in-app digest.
- Worker failures should mark the generated digest failed and preserve a sanitized error message.

## Testing

Add focused coverage for:

- Rule parsing and matching, including phrases, keywords, exclusions, and empty terms.
- Source selection queries for all feeds, selected folders, and selected feeds.
- Due rule scheduler behavior and duplicate prevention.
- Digest creation for matches and no-match runs.
- Email rendering and delivery state.
- Entitlement limits for free and admin users.
- Page rendering for rule list, builder, and digest detail.

## Deployment Notes

This feature requires a Prisma migration and worker update. Deployment should preserve the production `.env`, run migrations through the existing Docker Compose flow, rebuild the app and worker, then verify `docker compose ps` and the health endpoint.
