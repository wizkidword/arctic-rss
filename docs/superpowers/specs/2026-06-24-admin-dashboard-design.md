# Milestone 10 Admin Dashboard Design

## Source And Goal

The Arctic RSS project plan defines Milestone 10 as:

- Admin statistics
- User list
- Feed health list
- AI usage dashboard
- Failed job display

The acceptance criteria are that an administrator can monitor application
health, identify failing feeds, and inspect AI cost and usage.

This milestone replaces the existing `/admin` placeholder with a read-only
operational console. Account mutations, billing controls, and automated
remediation are outside this milestone.

## Architecture

The dashboard uses three focused layers:

1. `src/lib/admin-dashboard.ts` is a server-only data access module. It
   aggregates bounded, display-ready database results and never returns
   password hashes, session tokens, provider credentials, or raw Prisma
   records.
2. `src/lib/admin-queues.ts` inspects the feed-refresh and AI-digest BullMQ
   queues. Queue failures are converted into small display records. Redis
   errors are caught and returned as an unavailable status so database health
   remains visible.
3. `src/app/admin/page.tsx` authenticates the request, verifies the `ADMIN`
   role, fetches both sources in parallel, and renders the operational console.

No new database models are required. Feed errors, failed AI digests, failed
imports, AI usage logs, and user status already have durable storage.

## Dashboard Content

### Overview

The first band shows:

- Total and active users
- Total feeds and currently failing feeds
- Stored articles
- Active subscriptions
- AI requests in the current UTC month
- Estimated AI cost in the current UTC month

### Users

Show the 50 newest users with:

- Name and email
- Role and plan
- Active or disabled state
- Subscription count
- Current monthly AI usage and limit
- Signup date

The list is intentionally read-only. `disabledAt` is displayed, but changing it
is not part of the monitoring acceptance criteria.

### Feed Health

Show up to 50 feeds that currently have `lastError`, ordered by the most recent
failure. Each row includes:

- Feed title and URL
- Subscriber count
- Last successful fetch
- Last failed fetch
- Sanitized stored error

Also report stale feeds: subscribed feeds whose last successful fetch is older
than 24 hours or absent.

### AI Usage

Use `AiUsageLog` as the source of truth for the current UTC month. Show:

- Request count
- Input and output token totals
- Estimated cost
- Breakdown by action
- Breakdown by provider and model
- Ten most recent usage records

Decimal costs are converted to finite JavaScript numbers in the data layer.

### Failed Jobs

The failure section combines:

- Failed feed-refresh BullMQ jobs
- Failed AI-digest BullMQ jobs
- Failed persisted AI digests
- Failed persisted OPML imports

Queue records show queue, job ID, attempts, failure reason, and timestamp.
Persisted records show their type, identifier, user, message, and timestamp.
All lists are bounded to 25 recent entries.

## Authorization And Failure Handling

- `/admin` redirects anonymous users to `/login`.
- Authenticated non-admin users are redirected to `/app`.
- The data access function also requires an explicit admin authorization flag,
  preventing accidental use without authorization.
- No secrets or password fields are selected.
- Queue inspection failure does not fail the page. The failed-job panel shows
  an unavailable state while the database-backed sections continue rendering.
- Stored errors are truncated for readable, bounded output.

## Interface

The dashboard follows Arctic RSS's existing white, neutral, work-focused
interface. It uses compact metric blocks, tables/lists, semantic status badges,
and Lucide icons. It does not introduce a new marketing-style visual system or
image assets.

Desktop uses a dense two-column operational layout where appropriate. Mobile
turns tables into horizontally scrollable regions without allowing page-level
overflow. The header includes a return-to-reader action.

Administrators also receive an Admin Dashboard entry in the existing account
menu.

## Testing And Verification

Automated tests cover:

- UTC month boundaries and cost conversion
- Aggregated overview counts
- User display mapping without sensitive fields
- Failing and stale feed mapping
- AI action/provider grouping
- Persisted failure mapping
- BullMQ job mapping
- Redis-unavailable fallback
- Admin page authorization and key rendered states where practical

Final verification includes the full test suite, typecheck, lint, production
build, Docker rebuild, database-backed browser QA, desktop and mobile overflow
checks, and cleanup of temporary QA data.

## Milestone Boundary

Milestone 10 ends when the operational admin console satisfies the source-plan
acceptance criteria. Milestone 11 remains production deployment documentation,
validation, and reuse of the active Cloudflare Tunnel for
the reviewed canonical public origin.
