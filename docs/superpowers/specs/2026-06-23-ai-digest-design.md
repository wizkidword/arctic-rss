# Arctic RSS AI Digest Design

## Objective

Complete Milestone 9 from the original Arctic RSS plan by letting an
authenticated user generate, store, and revisit an AI digest built from their
unread articles.

This milestone remains an enhancement to the reader. Feed reading, article
state, and all non-AI workflows continue to work when AI is disabled or
unavailable.

## Scope

Milestone 9 includes:

- Manual digest generation from the `/app/ai` dashboard.
- A dedicated BullMQ digest queue processed by the existing worker container.
- Selection of up to 20 newest unread articles from active subscriptions.
- User-scoped access to every selected article and stored digest.
- Topic grouping with explicit `MUST_READ` and `SKIM_LATER` sections.
- Stored digest records and article snapshots.
- Pending, completed, and failed digest states.
- Digest history on `/app/ai`.
- Monthly AI limit enforcement and `DAILY_DIGEST` usage logging.
- Deterministic local generation by default and optional OpenAI generation.

Milestone 9 does not include:

- Scheduled morning or evening generation.
- Email delivery.
- Push notifications.
- Automatically marking digest articles as read.
- Digests from paused subscriptions or articles already marked read.
- Smart feed recommendations or article chat.

## User Workflow

1. The user opens `/app/ai`.
2. The dashboard reports how many unread articles are currently eligible.
3. The user selects **Generate digest**.
4. The authenticated server action creates a `PENDING` digest and enqueues one
   BullMQ job using the digest ID as its stable job identifier.
5. The dashboard shows the pending digest immediately.
6. The worker loads the digest, verifies the owning user still exists, selects
   the user's eligible unread articles, and generates the digest.
7. The worker stores grouped digest items and updates the digest to
   `COMPLETED`.
8. The user can open the completed digest from dashboard history. Article links
   use the existing stable article routes.
9. If generation fails, the stored digest becomes `FAILED` with a concise,
   non-sensitive error message and can be regenerated with a new request.

## Data Model

Add an `AiDigestStatus` enum:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

Add an `AiDigestSection` enum:

- `MUST_READ`
- `SKIM_LATER`

Add an `AiDigest` model with:

- `id`
- `userId`
- `status`
- `title`
- `overview`
- `provider`
- `model`
- `articleCount`
- `inputTokens`
- `outputTokens`
- `errorMessage`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

Add an `AiDigestItem` model with:

- `id`
- `digestId`
- `articleId`
- `section`
- `topic`
- `position`
- `articleTitle`
- `articleUrl`
- `feedTitle`
- `summary`
- `reason`
- `publishedAt`
- `createdAt`

Digest items store a readable snapshot so history remains coherent if a feed or
article title changes later. The optional article relation still allows links
to the live reader article while it exists.

Index digests by `(userId, createdAt)` and items by `(digestId, section,
position)`.

## Eligible Articles

An article is eligible when:

- It belongs to a feed with an active, non-paused subscription for the user.
- It is not read for that user. A missing `ArticleState` counts as unread.
- It has a non-empty title and usable summary or body text.

Selection is ordered by `publishedAt DESC`, then `createdAt DESC`, and limited
to 20 articles.

Digest generation does not create or alter `ArticleState` rows.

## Provider Contract

Create a digest provider contract independent of the article-summary provider:

- `name`
- `model`
- `generate(input)`

The input contains normalized article snapshots. The result contains:

- Digest title
- Brief overview
- `MUST_READ` items
- `SKIM_LATER` items
- Topic, summary, and selection reason for each item
- Input and output token counts

The local provider uses deterministic rules:

- Newest articles with available AI summaries are ranked first.
- Remaining articles use stored feed summaries or normalized article text.
- The first five ranked items become `MUST_READ`.
- Remaining items become `SKIM_LATER`.
- Topic uses an existing AI summary category when available, otherwise the
  folder name, otherwise the feed title.

The OpenAI provider returns strict structured JSON through the same provider
interface. Provider output is validated before database writes.

## Usage Limits

Before work begins, the worker verifies:

- The digest belongs to the requesting user.
- The user has not reached `aiMonthlyLimit`.
- At least one eligible unread article exists.

A completed digest increments `aiMonthlyUsed` once and writes one
`AiUsageLog` row using the `DAILY_DIGEST` action. Failed and empty digest jobs
do not consume usage.

Only one pending or processing digest may exist per user. Repeated submissions
while one is active return the existing digest rather than enqueueing duplicate
work.

## Queue And Worker

Add a dedicated `ai-digest` BullMQ queue. Jobs contain only:

- `digestId`

Default behavior:

- Three attempts.
- Exponential backoff starting at 10 seconds.
- Completed jobs removed.
- Failed jobs retained for 24 hours, capped at 1,000.

The existing worker process hosts both the feed-refresh worker and digest
worker. Each queue has its own concurrency environment setting and failure
logging. Shutdown closes both workers and shared resources cleanly.

## Web Application

The `/app/ai` dashboard gains:

- Eligible unread article count.
- **Generate digest** action.
- Pending/processing status.
- Latest completed digest summary.
- Digest history with status and creation time.

Add `/app/ai/digests/[digestId]`:

- Re-authenticate and scope lookup by `userId`.
- Display title, overview, generation metadata, and article count.
- Render `Must Read` and `Skim Later` as separate compact lists.
- Group or label items by topic without hiding the two required sections.
- Link each available article to its stable Arctic RSS detail route.
- Provide clear pending, failed, and empty states.

The existing `dailyDigestEnabled` preference remains stored but does not
schedule work in this milestone. Its label should make clear that scheduling is
not active until the later delivery milestone.

## Error Handling

- The server action returns readable authentication, active-job, empty-source,
  and monthly-limit errors.
- Worker failures update the digest record before BullMQ retries.
- Final failure remains visible in history.
- Stored error messages are capped and exclude provider credentials, response
  bodies, and stack traces.
- A deleted user or digest causes the job to end without cross-user access.

## Testing

Unit tests cover:

- Eligible unread article selection and user scoping.
- Read-state exclusion, paused-subscription exclusion, and 20-item limit.
- Deterministic local section and topic assignment.
- Monthly-limit enforcement.
- Idempotent pending digest creation.
- Completed digest storage, usage increment, and usage log creation.
- Failed digest status and sanitized error storage.
- Stable BullMQ job IDs.
- Authenticated generation action and revalidation.
- Dashboard and detail-page mapping.

Integration verification covers:

- Full test, typecheck, lint, and production build.
- Docker rebuild with web and worker healthy.
- Browser generation from `/app/ai`.
- Pending-to-completed transition.
- Stored digest detail rendering.
- Desktop and 390-pixel mobile layouts without overflow.

## Milestone Sequence

After Milestone 9:

1. Milestone 10 builds operational admin statistics, users, feed health, AI
   usage, and failed-job views.
2. Milestone 11 completes production deployment documentation and validation.
3. The final deployment reuses the existing active Cloudflare Tunnel and maps
   Arctic RSS to `https://arcticrss.taverncellar.com`.
4. Scheduled morning/evening digest generation and email delivery follow after
   the original MVP milestones unless deliberately promoted into Milestone 11.
