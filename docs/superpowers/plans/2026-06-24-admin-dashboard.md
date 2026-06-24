# Milestone 10 Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the `/admin` placeholder with a protected operational console for application statistics, users, feed health, AI usage, and failed jobs.

**Architecture:** A server-only database aggregation module returns bounded display DTOs, while a separate BullMQ inspector returns queue health and recent failed jobs with a graceful Redis-unavailable fallback. The Next.js Server Component authorizes administrators and renders the existing Arctic RSS visual system without exposing raw database records.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, Prisma 7/PostgreSQL, BullMQ/Redis, Vitest, Tailwind CSS, shadcn/ui, Lucide React.

---

### Task 1: Database Dashboard Aggregation

**Files:**
- Create: `src/lib/admin-dashboard.ts`
- Create: `src/lib/admin-dashboard.test.ts`

- [x] **Step 1: Write failing aggregation tests**

Cover overview counts, UTC current-month filters, finite decimal cost mapping,
bounded user DTOs, failing/stale feeds, AI breakdowns, and persisted failures.
Use an injected store interface so the tests exercise real mapping logic
without a database.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/lib/admin-dashboard.test.ts
```

Expected: FAIL because `admin-dashboard.ts` does not exist.

- [x] **Step 3: Implement the server-only aggregation module**

Create:

```ts
export async function getAdminDashboardWithClient({
  isAdmin,
  now = () => new Date(),
  store,
}: {
  isAdmin: boolean
  now?: () => Date
  store: AdminDashboardStore
}) {
  if (!isAdmin) {
    throw new AdminDashboardError("Administrator access is required.")
  }

  const monthStart = startOfUtcMonth(now())
  const [
    userCount,
    activeUserCount,
    feedCount,
    failingFeedCount,
    articleCount,
    activeSubscriptionCount,
    users,
    failingFeeds,
    staleFeedCount,
    aiUsage,
    aiByAction,
    aiByProviderModel,
    recentAiUsage,
    failedDigests,
    failedImports,
  ] = await Promise.all([
    store.user.count({}),
    store.user.count({ where: { disabledAt: null } }),
    store.feed.count({}),
    store.feed.count({ where: { lastError: { not: null } } }),
    store.article.count({}),
    store.feedSubscription.count({ where: { isPaused: false } }),
    store.user.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    store.feed.findMany({
      orderBy: { lastFailedAt: "desc" },
      take: 50,
      where: { lastError: { not: null } },
    }),
    store.feed.count({
      where: {
        subscriptions: { some: { isPaused: false } },
        OR: [
          { lastSuccessfulFetchAt: null },
          { lastSuccessfulFetchAt: { lt: staleBefore } },
        ],
      },
    }),
    store.aiUsageLog.aggregate({
      _count: { _all: true },
      _sum: {
        costEstimate: true,
        inputTokens: true,
        outputTokens: true,
      },
      where: { createdAt: { gte: monthStart } },
    }),
    store.aiUsageLog.groupBy({
      _count: { _all: true },
      _sum: { costEstimate: true, inputTokens: true, outputTokens: true },
      by: ["action"],
      where: { createdAt: { gte: monthStart } },
    }),
    store.aiUsageLog.groupBy({
      _count: { _all: true },
      _sum: { costEstimate: true, inputTokens: true, outputTokens: true },
      by: ["provider", "model"],
      where: { createdAt: { gte: monthStart } },
    }),
    store.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { createdAt: { gte: monthStart } },
    }),
    store.aiDigest.findMany({
      orderBy: { updatedAt: "desc" },
      take: 25,
      where: { status: "FAILED" },
    }),
    store.importJob.findMany({
      orderBy: { updatedAt: "desc" },
      take: 25,
      where: { status: "FAILED" },
    }),
  ])

  return mapAdminDashboard({
    activeSubscriptionCount,
    activeUserCount,
    aiByAction,
    aiByProviderModel,
    aiUsage,
    articleCount,
    failedDigests,
    failedImports,
    failingFeedCount,
    failingFeeds,
    feedCount,
    monthStart,
    recentAiUsage,
    staleFeedCount,
    userCount,
    users,
  })
}
```

The production wrapper calls `getPrisma()` lazily. Select only fields needed by
the UI and truncate stored failure messages.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/lib/admin-dashboard.test.ts
```

Expected: PASS.

### Task 2: Queue Failure Inspection

**Files:**
- Create: `src/lib/admin-queues.ts`
- Create: `src/lib/admin-queues.test.ts`

- [x] **Step 1: Write failing queue-inspection tests**

Cover feed and digest job-count mapping, failed-job normalization, timestamp
conversion, message truncation, and a Redis-unavailable fallback.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/lib/admin-queues.test.ts
```

Expected: FAIL because `admin-queues.ts` does not exist.

- [x] **Step 3: Implement queue inspection with injected queue readers**

Expose:

```ts
export async function inspectAdminQueuesWithClients({
  feedQueue,
  digestQueue,
}: {
  feedQueue: AdminQueueReader
  digestQueue: AdminQueueReader
}): Promise<AdminQueueSnapshot>
```

The production wrapper lazily creates both BullMQ queues, catches connection
errors, and closes queue handles after inspection. Return `available: false`
instead of throwing when Redis cannot be reached.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/lib/admin-queues.test.ts
```

Expected: PASS.

### Task 3: Operational Dashboard UI

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/components/admin-dashboard.tsx`
- Create: `src/components/admin-dashboard.test.tsx`

- [x] **Step 1: Write failing component tests**

Render representative DTOs and assert the overview, users, failing feeds, AI
usage, persisted failures, queue failures, and queue-unavailable state.

- [x] **Step 2: Run the component test and verify RED**

Run:

```powershell
npm test -- src/components/admin-dashboard.test.tsx
```

Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement the dashboard component**

Build a dense operational surface with:

- Header and return-to-reader action
- Six overview metrics
- User table
- Failing feed table and stale-feed count
- AI request/token/cost summary with action and provider/model breakdowns
- Combined persisted and queue failure lists
- Explicit empty and Redis-unavailable states

Keep tables inside `overflow-x-auto` containers and use stable minimum widths.

- [x] **Step 4: Wire the protected Server Component**

In `src/app/admin/page.tsx`, call `auth()`, redirect anonymous/non-admin users,
and fetch database plus queue dashboard data in parallel. Pass only the mapped
DTOs into the component.

- [x] **Step 5: Run the component test and verify GREEN**

Run:

```powershell
npm test -- src/components/admin-dashboard.test.tsx
```

Expected: PASS.

### Task 4: Admin Navigation

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/components/app-shell.test.tsx`

- [x] **Step 1: Write the failing admin-navigation test**

Assert that an admin receives a linked `Admin Dashboard` account-menu item and
a regular user does not.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/components/app-shell.test.tsx
```

Expected: FAIL because the linked menu item is absent.

- [x] **Step 3: Add the role-scoped navigation entry**

Use a Lucide dashboard icon and a real Next.js link rendered through the
existing dropdown menu primitive.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/components/app-shell.test.tsx
```

Expected: PASS.

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `README.md`

- [x] **Step 1: Mark Milestone 10 complete**

Move the admin dashboard capabilities into the completed list and identify
Milestone 11 production deployment as next. Preserve the final Cloudflare
Tunnel hostname.

- [x] **Step 2: Run automated verification**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass without project warnings.

- [x] **Step 3: Rebuild and verify Docker**

Run:

```powershell
docker compose up -d --build
docker compose ps
```

Expected: web, worker, PostgreSQL, and Redis are running; stateful services are
healthy.

- [x] **Step 4: Browser QA**

Create temporary admin-visible database fixtures, sign in as an administrator,
and verify `/admin` on desktop and a 390-pixel mobile viewport. Confirm:

- Correct totals and lists
- Failing feed and AI cost visibility
- Queue status visibility
- Admin navigation works
- No console errors
- No page-level horizontal overflow

Capture implementation screenshots, inspect them with `view_image`, then
delete all temporary QA data and artifacts not needed for the handoff.
