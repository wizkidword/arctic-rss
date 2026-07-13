# Smart Digests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build rule-based Smart Digests that watch selected subscribed feeds for topic keywords, save generated digests in-app, and optionally email matching articles.

**Architecture:** Add dedicated Smart Digest tables rather than overloading the existing AI digest tables. Keep matching deterministic in version 1 with a pure matcher module, then wire persistence, queue processing, email, and UI around that boundary so a later `HYBRID_AI` paid mode can plug in without reshaping the feature.

**Tech Stack:** Next.js App Router, React server/client components, Prisma 7 with `db push`, BullMQ, Nodemailer, Vitest, existing Docker Compose worker/web services.

---

## Current Project Notes

- The `arctic-rss` app directory is not a git repository. Replace commit steps with the listed verification checkpoints.
- The current Docker Compose `migrate` service runs `npx prisma db push`, and there is no `prisma/migrations` directory. Use schema changes plus `npm run prisma:generate` locally, then deploy through the existing Docker Compose flow.
- Preserve all secret-handling rules. Do not print `.env`, SMTP credentials, OpenAI keys, or Cloudflare values.

## File Map

- Modify `prisma/schema.prisma`: Smart Digest enums and models.
- Create `src/lib/smart-digest-rules.ts`: pure term parsing and article matching.
- Create `src/lib/smart-digest-rules.test.ts`: matcher coverage.
- Create `src/lib/smart-digest-limits.ts`: free/admin rule limits.
- Create `src/lib/smart-digests.ts`: rule CRUD, source options, digest reads, due-rule selection.
- Create `src/lib/smart-digests.test.ts`: persistence and entitlement tests with mocked Prisma-like store.
- Create `src/lib/smart-digest-processing.ts`: process one due rule into a generated digest and email state.
- Create `src/lib/smart-digest-processing.test.ts`: processing coverage.
- Create `src/lib/smart-digest-queue.ts`: BullMQ queue wrapper.
- Create `src/lib/smart-digest-queue.test.ts`: job id coverage.
- Modify `src/lib/mail.ts`: add Smart Digest email renderer/sender.
- Modify `src/lib/mail.test.ts`: email rendering and transport assertions.
- Modify `worker/index.ts`: add Smart Digest worker and scheduler.
- Create `src/app/app/smart-digests/actions.ts`: server actions for create/update/pause/delete/run-now.
- Create `src/components/smart-digest-rule-form.tsx`: builder form.
- Create `src/components/smart-digest-rule-list.tsx`: rule list.
- Create `src/components/smart-digest-detail.tsx`: generated digest detail.
- Create `src/app/app/smart-digests/page.tsx`: dashboard/list page.
- Create `src/app/app/smart-digests/new/page.tsx`: new rule page.
- Create `src/app/app/smart-digests/[ruleId]/page.tsx`: edit/detail rule page.
- Create `src/app/app/smart-digests/digests/[digestId]/page.tsx`: generated digest page.
- Add tests beside the pages/components above following the existing render-to-static-markup style.
- Modify `src/components/app-shell.tsx` and `src/components/app-shell.test.tsx`: add left-nav Smart Digests entry.

---

### Task 1: Prisma Schema and Client

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums near the existing AI enums**

Add these enums after `AiDigestSection`:

```prisma
enum SmartDigestMatchingMode {
  RULES
  HYBRID_AI
}

enum SmartDigestSourceScope {
  ALL_FEEDS
  FOLDERS
  FEEDS
}

enum SmartDigestCadence {
  DAILY
}

enum SmartDigestStatus {
  PENDING
  PROCESSING
  COMPLETED
  COMPLETED_NO_MATCHES
  FAILED
}

enum SmartDigestEmailStatus {
  NOT_REQUESTED
  PENDING
  SENT
  FAILED
}
```

- [ ] **Step 2: Add user relation fields**

Add these relation fields inside `model User` near `aiDigests`:

```prisma
  smartDigestRules         SmartDigestRule[]
  smartDigests             SmartDigest[]
```

- [ ] **Step 3: Add Smart Digest models after `AiDigestItem`**

```prisma
model SmartDigestRule {
  id             String                  @id @default(cuid())
  userId         String
  name           String
  topicPrompt    String
  matchingMode   SmartDigestMatchingMode @default(RULES)
  includeTerms   String[]                @default([])
  excludeTerms   String[]                @default([])
  sourceScope    SmartDigestSourceScope  @default(ALL_FEEDS)
  emailEnabled   Boolean                 @default(false)
  cadence        SmartDigestCadence      @default(DAILY)
  scheduledHour  Int                     @default(8)
  timeZone       String                  @default("UTC")
  lastRunAt      DateTime?
  nextRunAt      DateTime?
  lastMatchedAt  DateTime?
  isEnabled      Boolean                 @default(true)
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  user          User                          @relation(fields: [userId], references: [id], onDelete: Cascade)
  folders       SmartDigestRuleFolder[]
  subscriptions SmartDigestRuleSubscription[]
  digests       SmartDigest[]

  @@unique([userId, id])
  @@index([userId, isEnabled])
  @@index([isEnabled, nextRunAt])
}

model SmartDigestRuleFolder {
  id        String   @id @default(cuid())
  userId    String
  ruleId    String
  folderId  String
  createdAt DateTime @default(now())

  rule   SmartDigestRule @relation(fields: [userId, ruleId], references: [userId, id], onDelete: Cascade)
  folder Folder          @relation(fields: [userId, folderId], references: [userId, id], onDelete: Cascade)

  @@unique([ruleId, folderId])
  @@index([folderId])
}

model SmartDigestRuleSubscription {
  id             String   @id @default(cuid())
  userId         String
  ruleId         String
  subscriptionId String
  createdAt      DateTime @default(now())

  rule         SmartDigestRule  @relation(fields: [userId, ruleId], references: [userId, id], onDelete: Cascade)
  subscription FeedSubscription @relation(fields: [userId, subscriptionId], references: [userId, id], onDelete: Cascade)

  @@unique([ruleId, subscriptionId])
  @@index([subscriptionId])
}

model SmartDigest {
  id                String                 @id @default(cuid())
  userId            String
  ruleId            String
  status            SmartDigestStatus      @default(PENDING)
  emailStatus       SmartDigestEmailStatus @default(NOT_REQUESTED)
  title             String
  topicPrompt       String
  articleCount      Int                    @default(0)
  errorMessage      String?
  emailErrorMessage String?
  startedAt         DateTime?
  completedAt       DateTime?
  emailedAt         DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  rule  SmartDigestRule @relation(fields: [userId, ruleId], references: [userId, id], onDelete: Cascade)
  items SmartDigestItem[]

  @@index([userId, createdAt])
  @@index([ruleId, createdAt])
  @@index([status, createdAt])
  @@index([emailStatus, createdAt])
}

model SmartDigestItem {
  id            String   @id @default(cuid())
  digestId      String
  articleId     String?
  articleTitle  String
  articleUrl    String
  feedTitle     String
  summary       String
  matchedTerms  String[] @default([])
  matchedFields String[] @default([])
  reason        String
  position      Int
  publishedAt   DateTime?
  createdAt     DateTime @default(now())

  digest  SmartDigest @relation(fields: [digestId], references: [id], onDelete: Cascade)
  article Article?     @relation(fields: [articleId], references: [id], onDelete: SetNull)

  @@unique([digestId, articleId])
  @@unique([digestId, position])
  @@index([articleId])
}
```

- [ ] **Step 4: Add back-relations to existing models**

Add to `model Folder`:

```prisma
  smartDigestRules SmartDigestRuleFolder[]
```

Add to `model FeedSubscription`:

```prisma
  smartDigestRules SmartDigestRuleSubscription[]
```

Add to `model Article`:

```prisma
  smartDigestItems SmartDigestItem[]
```

- [ ] **Step 5: Generate Prisma client**

Run:

```powershell
npm run prisma:generate
```

Expected: Prisma client generation completes and updates `src/generated/prisma`.

---

### Task 2: Rule Parser and Matcher

**Files:**
- Create: `src/lib/smart-digest-rules.ts`
- Create: `src/lib/smart-digest-rules.test.ts`

- [ ] **Step 1: Write matcher tests**

Create `src/lib/smart-digest-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  matchSmartDigestArticle,
  parseSmartDigestTerms,
} from "./smart-digest-rules"

const article = {
  contentText:
    "Officials discussed sanctions and nuclear inspections after talks.",
  feedTitle: "World Desk",
  summary: "Iran and U.S. diplomats met after a regional escalation.",
  title: "Iran-U.S. conflict talks resume",
}

describe("Smart Digest rule matching", () => {
  it("parses quoted phrases and loose keywords", () => {
    expect(parseSmartDigestTerms('"Iran-U.S. conflict" sanctions')).toEqual([
      { kind: "phrase", value: "iran-u.s. conflict" },
      { kind: "keyword", value: "sanctions" },
    ])
  })

  it("matches phrases and records matched fields", () => {
    expect(
      matchSmartDigestArticle({
        article,
        excludeTerms: [],
        includeTerms: ['"Iran-U.S. conflict"', "sanctions"],
      })
    ).toEqual({
      matched: true,
      matchedFields: ["title", "contentText"],
      matchedTerms: ["iran-u.s. conflict", "sanctions"],
      reason: 'Matched "iran-u.s. conflict" in title and "sanctions" in contentText.',
    })
  })

  it("rejects articles when an exclude term matches", () => {
    expect(
      matchSmartDigestArticle({
        article,
        excludeTerms: ["diplomats"],
        includeTerms: ["Iran"],
      })
    ).toMatchObject({
      matched: false,
      reason: 'Excluded by "diplomats" in summary.',
    })
  })

  it("does not match partial words for keywords", () => {
    expect(
      matchSmartDigestArticle({
        article: { ...article, title: "The train arrived" },
        excludeTerms: [],
        includeTerms: ["Iran"],
      })
    ).toMatchObject({ matched: false })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/lib/smart-digest-rules.test.ts
```

Expected: FAIL because `src/lib/smart-digest-rules.ts` does not exist.

- [ ] **Step 3: Implement matcher**

Create `src/lib/smart-digest-rules.ts`:

```ts
export type SmartDigestParsedTerm = {
  kind: "keyword" | "phrase"
  value: string
}

export type SmartDigestMatchArticle = {
  contentText: string | null
  feedTitle: string
  summary: string | null
  title: string
}

export type SmartDigestMatchResult =
  | {
      matched: true
      matchedFields: string[]
      matchedTerms: string[]
      reason: string
    }
  | {
      matched: false
      matchedFields: string[]
      matchedTerms: string[]
      reason: string
    }

export function parseSmartDigestTerms(value: string | string[]) {
  const source = Array.isArray(value) ? value.join(" ") : value
  const terms: SmartDigestParsedTerm[] = []
  const pattern = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    const raw = normalizeTerm(match[1] || match[2] || "")

    if (!raw) {
      continue
    }

    terms.push({
      kind: match[1] ? "phrase" : "keyword",
      value: raw,
    })
  }

  return dedupeTerms(terms)
}

export function matchSmartDigestArticle({
  article,
  excludeTerms,
  includeTerms,
}: {
  article: SmartDigestMatchArticle
  excludeTerms: string[]
  includeTerms: string[]
}): SmartDigestMatchResult {
  const fields = articleFields(article)
  const excludes = parseSmartDigestTerms(excludeTerms)

  for (const term of excludes) {
    const field = fields.find((candidate) => fieldMatches(candidate.value, term))

    if (field) {
      return {
        matched: false,
        matchedFields: [field.name],
        matchedTerms: [term.value],
        reason: `Excluded by "${term.value}" in ${field.name}.`,
      }
    }
  }

  const includes = parseSmartDigestTerms(includeTerms)
  const matchedTerms: string[] = []
  const matchedFields: string[] = []
  const reasonParts: string[] = []

  for (const term of includes) {
    const field = fields.find((candidate) => fieldMatches(candidate.value, term))

    if (!field) {
      continue
    }

    matchedTerms.push(term.value)

    if (!matchedFields.includes(field.name)) {
      matchedFields.push(field.name)
    }

    reasonParts.push(`"${term.value}" in ${field.name}`)
  }

  if (!matchedTerms.length) {
    return {
      matched: false,
      matchedFields: [],
      matchedTerms: [],
      reason: "No include terms matched.",
    }
  }

  return {
    matched: true,
    matchedFields,
    matchedTerms,
    reason: `Matched ${joinReasonParts(reasonParts)}.`,
  }
}

function articleFields(article: SmartDigestMatchArticle) {
  return [
    { name: "title", value: normalizeSearchText(article.title) },
    { name: "feedTitle", value: normalizeSearchText(article.feedTitle) },
    { name: "summary", value: normalizeSearchText(article.summary || "") },
    { name: "contentText", value: normalizeSearchText(article.contentText || "") },
  ]
}

function fieldMatches(value: string, term: SmartDigestParsedTerm) {
  if (!value) {
    return false
  }

  if (term.kind === "phrase") {
    return value.includes(term.value)
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.value)}([^a-z0-9]|$)`, "i").test(value)
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeTerm(value: string) {
  return normalizeSearchText(value.replace(/^[-]+/, ""))
}

function dedupeTerms(terms: SmartDigestParsedTerm[]) {
  const seen = new Set<string>()

  return terms.filter((term) => {
    const key = `${term.kind}:${term.value}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function joinReasonParts(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] || "selected terms"
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
}
```

- [ ] **Step 4: Run matcher tests**

Run:

```powershell
npm test -- src/lib/smart-digest-rules.test.ts
```

Expected: PASS.

---

### Task 3: Limits and Rule Persistence

**Files:**
- Create: `src/lib/smart-digest-limits.ts`
- Create: `src/lib/smart-digests.ts`
- Create: `src/lib/smart-digests.test.ts`

- [ ] **Step 1: Add limit helper**

Create `src/lib/smart-digest-limits.ts`:

```ts
import type { Plan } from "../generated/prisma/enums"

export const SMART_DIGEST_FREE_ENABLED_LIMIT = 1
export const SMART_DIGEST_PRO_ENABLED_LIMIT = 10

export function smartDigestEnabledLimitForPlan(plan: Plan) {
  if (plan === "ADMIN") {
    return Number.POSITIVE_INFINITY
  }

  if (plan === "PRO") {
    return SMART_DIGEST_PRO_ENABLED_LIMIT
  }

  return SMART_DIGEST_FREE_ENABLED_LIMIT
}
```

- [ ] **Step 2: Write rule service tests**

Create `src/lib/smart-digests.test.ts` with tests for:

```ts
import { describe, expect, it, vi } from "vitest"

import {
  SmartDigestError,
  normalizeSmartDigestInput,
  scheduleNextSmartDigestRun,
} from "./smart-digests"

describe("Smart Digest service", () => {
  it("requires at least one include term", () => {
    expect(() =>
      normalizeSmartDigestInput({
        emailEnabled: true,
        excludeTerms: "",
        includeTerms: "   ",
        name: "Conflict Watch",
        scheduledHour: 8,
        sourceScope: "ALL_FEEDS",
        timeZone: "America/New_York",
        topicPrompt: "Iran-U.S. conflict",
      })
    ).toThrow(new SmartDigestError("Add at least one include term."))
  })

  it("normalizes terms and schedule inputs", () => {
    expect(
      normalizeSmartDigestInput({
        emailEnabled: true,
        excludeTerms: "sports",
        includeTerms: '"Iran-U.S. conflict" sanctions',
        name: " Conflict Watch ",
        scheduledHour: 25,
        sourceScope: "ALL_FEEDS",
        timeZone: "America/New_York",
        topicPrompt: " Iran-U.S. conflict ",
      })
    ).toMatchObject({
      emailEnabled: true,
      excludeTerms: ["sports"],
      includeTerms: ['"Iran-U.S. conflict"', "sanctions"],
      name: "Conflict Watch",
      scheduledHour: 23,
      sourceScope: "ALL_FEEDS",
      timeZone: "America/New_York",
      topicPrompt: "Iran-U.S. conflict",
    })
  })

  it("schedules the next run for the selected local hour", () => {
    const nextRun = scheduleNextSmartDigestRun({
      from: new Date("2026-06-30T12:00:00.000Z"),
      scheduledHour: 8,
      timeZone: "America/New_York",
    })

    expect(nextRun.toISOString()).toBe("2026-07-01T12:00:00.000Z")
  })
})
```

- [ ] **Step 3: Implement service shell**

Create `src/lib/smart-digests.ts` with:

```ts
import { getPrisma } from "./db"
import { smartDigestEnabledLimitForPlan } from "./smart-digest-limits"
import { parseSmartDigestTerms } from "./smart-digest-rules"

export class SmartDigestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SmartDigestError"
  }
}

export type SmartDigestInput = {
  emailEnabled: boolean
  excludeTerms: string
  feedSubscriptionIds?: string[]
  folderIds?: string[]
  includeTerms: string
  name: string
  scheduledHour: number
  sourceScope: "ALL_FEEDS" | "FOLDERS" | "FEEDS"
  timeZone: string
  topicPrompt: string
}

export function normalizeSmartDigestInput(input: SmartDigestInput) {
  const includeTerms = splitStoredTerms(input.includeTerms)
  const excludeTerms = splitStoredTerms(input.excludeTerms)
  const name = compactWhitespace(input.name)
  const topicPrompt = compactWhitespace(input.topicPrompt)

  if (!name) {
    throw new SmartDigestError("Name this digest.")
  }

  if (!topicPrompt) {
    throw new SmartDigestError("Describe the topic to follow.")
  }

  if (!parseSmartDigestTerms(includeTerms).length) {
    throw new SmartDigestError("Add at least one include term.")
  }

  return {
    emailEnabled: input.emailEnabled,
    excludeTerms,
    feedSubscriptionIds: Array.from(new Set(input.feedSubscriptionIds ?? [])),
    folderIds: Array.from(new Set(input.folderIds ?? [])),
    includeTerms,
    name,
    scheduledHour: clampHour(input.scheduledHour),
    sourceScope: input.sourceScope,
    timeZone: input.timeZone || "UTC",
    topicPrompt,
  }
}

export function scheduleNextSmartDigestRun({
  from,
  scheduledHour,
  timeZone,
}: {
  from: Date
  scheduledHour: number
  timeZone: string
}) {
  const local = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(from)
  const parts = Object.fromEntries(local.map((part) => [part.type, part.value]))
  const todayUtcGuess = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), scheduledHour)
  )
  const first = zonedHourToUtc(todayUtcGuess, scheduledHour, timeZone)

  if (first.getTime() > from.getTime()) {
    return first
  }

  return zonedHourToUtc(
    new Date(todayUtcGuess.getTime() + 24 * 60 * 60 * 1000),
    scheduledHour,
    timeZone
  )
}

export async function createSmartDigestRuleForUser({
  input,
  userId,
}: {
  input: SmartDigestInput
  userId: string
}) {
  const prisma = getPrisma()
  const normalized = normalizeSmartDigestInput(input)
  const user = await prisma.user.findUnique({
    select: {
      plan: true,
      _count: {
        select: {
          smartDigestRules: {
            where: { isEnabled: true },
          },
        },
      },
    },
    where: { id: userId },
  })

  if (!user) {
    throw new SmartDigestError("User not found.")
  }

  const limit = smartDigestEnabledLimitForPlan(user.plan)

  if (user._count.smartDigestRules >= limit) {
    throw new SmartDigestError("Free accounts can enable one Smart Digest.")
  }

  return prisma.smartDigestRule.create({
    data: {
      cadence: "DAILY",
      emailEnabled: normalized.emailEnabled,
      excludeTerms: normalized.excludeTerms,
      subscriptions: {
        create: normalized.feedSubscriptionIds.map((subscriptionId) => ({
          subscriptionId,
          userId,
        })),
      },
      folders: {
        create: normalized.folderIds.map((folderId) => ({ folderId, userId })),
      },
      includeTerms: normalized.includeTerms,
      name: normalized.name,
      nextRunAt: scheduleNextSmartDigestRun({
        from: new Date(),
        scheduledHour: normalized.scheduledHour,
        timeZone: normalized.timeZone,
      }),
      scheduledHour: normalized.scheduledHour,
      sourceScope: normalized.sourceScope,
      timeZone: normalized.timeZone,
      topicPrompt: normalized.topicPrompt,
      userId,
    },
  })
}

function splitStoredTerms(value: string) {
  return value
    .split(/[\n,]+/)
    .flatMap((part) => part.match(/"[^"]+"|\S+/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean)
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function clampHour(value: number) {
  if (!Number.isFinite(value)) {
    return 8
  }

  return Math.min(23, Math.max(0, Math.round(value)))
}

function zonedHourToUtc(dateGuess: Date, scheduledHour: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone,
  })
  const actualHour = Number(formatter.format(dateGuess))
  const hourDelta = scheduledHour - actualHour

  return new Date(dateGuess.getTime() + hourDelta * 60 * 60 * 1000)
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm test -- src/lib/smart-digests.test.ts
```

Expected: PASS.

- [ ] **Step 5: Extend service after base tests pass**

Add functions to `src/lib/smart-digests.ts`:

```ts
export async function listSmartDigestRulesForUser(userId: string) {
  return getPrisma().smartDigestRule.findMany({
    include: {
      digests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      subscriptions: {
        include: {
          subscription: {
            include: { feed: true },
          },
        },
      },
      folders: {
        include: { folder: true },
      },
    },
    orderBy: [{ isEnabled: "desc" }, { createdAt: "desc" }],
    where: { userId },
  })
}

export async function getSmartDigestRuleForUser({
  ruleId,
  userId,
}: {
  ruleId: string
  userId: string
}) {
  return getPrisma().smartDigestRule.findFirst({
    include: {
      subscriptions: true,
      folders: true,
    },
    where: { id: ruleId, userId },
  })
}

export async function listSmartDigestSourceOptions(userId: string) {
  const prisma = getPrisma()
  const [folders, subscriptions] = await Promise.all([
    prisma.folder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
      where: { userId },
    }),
    prisma.feedSubscription.findMany({
      include: { feed: true, folder: true },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      where: { isPaused: false, userId },
    }),
  ])

  return { folders, subscriptions }
}
```

Run:

```powershell
npm run typecheck
```

Expected: PASS after resolving generated type names.

---

### Task 4: Queue and Processing

**Files:**
- Create: `src/lib/smart-digest-queue.ts`
- Create: `src/lib/smart-digest-queue.test.ts`
- Create: `src/lib/smart-digest-processing.ts`
- Create: `src/lib/smart-digest-processing.test.ts`

- [ ] **Step 1: Add queue test**

Create `src/lib/smart-digest-queue.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { smartDigestJobId } from "./smart-digest-queue"

describe("Smart Digest queue", () => {
  it("builds stable job ids", () => {
    expect(smartDigestJobId("rule/1")).toBe("smart-digest-rule-1")
    expect(smartDigestJobId("rule:2")).toBe("smart-digest-rule-2")
  })
})
```

- [ ] **Step 2: Implement queue**

Create `src/lib/smart-digest-queue.ts`:

```ts
import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const SMART_DIGEST_QUEUE_NAME = "smart-digest"

export type SmartDigestJobData = {
  ruleId: string
}

let smartDigestQueue: Queue<SmartDigestJobData> | undefined

export function getSmartDigestQueue() {
  if (!smartDigestQueue) {
    smartDigestQueue = new Queue<SmartDigestJobData>(SMART_DIGEST_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return smartDigestQueue
}

export async function enqueueSmartDigestRule(
  ruleId: string,
  options: JobsOptions = {}
) {
  return getSmartDigestQueue().add(
    "generate-smart-digest",
    { ruleId },
    {
      attempts: 3,
      backoff: { delay: 10_000, type: "exponential" },
      jobId: smartDigestJobId(ruleId),
      removeOnComplete: true,
      removeOnFail: { age: 24 * 60 * 60, count: 1000 },
      ...options,
    }
  )
}

export function smartDigestJobId(ruleId: string) {
  return `smart-digest-${ruleId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}
```

- [ ] **Step 3: Run queue test**

Run:

```powershell
npm test -- src/lib/smart-digest-queue.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add processing tests**

Create tests that prove:

```ts
import { describe, expect, it, vi } from "vitest"

import { processSmartDigestRuleWithClient } from "./smart-digest-processing"

describe("Smart Digest processing", () => {
  it("creates a completed digest with matching articles", async () => {
    const store = createSmartDigestProcessingStore()

    await expect(
      processSmartDigestRuleWithClient({
        now: () => new Date("2026-06-30T13:00:00.000Z"),
        sendDigestEmail: vi.fn(async () => ({ status: "sent" })),
        store,
        ruleId: "rule-1",
      })
    ).resolves.toMatchObject({
      articleCount: 1,
      status: "COMPLETED",
    })
  })

  it("creates a no-match digest without sending email", async () => {
    const sendDigestEmail = vi.fn()
    const store = createSmartDigestProcessingStore({
      articleTitle: "Sports recap",
    })

    await expect(
      processSmartDigestRuleWithClient({
        now: () => new Date("2026-06-30T13:00:00.000Z"),
        sendDigestEmail,
        store,
        ruleId: "rule-1",
      })
    ).resolves.toMatchObject({
      articleCount: 0,
      status: "COMPLETED_NO_MATCHES",
    })
    expect(sendDigestEmail).not.toHaveBeenCalled()
  })
})
```

The helper store should mock `smartDigestRule.findUnique`, `article.findMany`, `$transaction`, and update calls with arrays. Keep it local to the test file.

- [ ] **Step 5: Implement processing**

Create `src/lib/smart-digest-processing.ts` with these exported functions:

```ts
import { getPrisma } from "./db"
import { sendSmartDigestEmail } from "./mail"
import { matchSmartDigestArticle } from "./smart-digest-rules"
import { scheduleNextSmartDigestRun, SmartDigestError } from "./smart-digests"

export async function processSmartDigestRule({
  ruleId,
}: {
  ruleId: string
}) {
  return processSmartDigestRuleWithClient({
    now: () => new Date(),
    sendDigestEmail: sendSmartDigestEmail,
    store: getPrisma(),
    ruleId,
  })
}

export async function processSmartDigestRuleWithClient({
  now,
  sendDigestEmail,
  store,
  ruleId,
}: {
  now: () => Date
  sendDigestEmail: typeof sendSmartDigestEmail
  store: any
  ruleId: string
}) {
  const generatedAt = now()
  const rule = await store.smartDigestRule.findUnique({
    include: {
      folders: true,
      subscriptions: true,
      user: { select: { email: true, id: true } },
    },
    where: { id: ruleId },
  })

  if (!rule || !rule.user || !rule.isEnabled) {
    throw new SmartDigestError("Smart Digest rule not found.")
  }

  const nextRunAt = scheduleNextSmartDigestRun({
    from: generatedAt,
    scheduledHour: rule.scheduledHour,
    timeZone: rule.timeZone,
  })
  const candidates = await store.article.findMany({
    include: { feed: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    where: smartDigestCandidateWhere(rule),
  })
  const matches = candidates
    .map((article: any) => {
      const result = matchSmartDigestArticle({
        article: {
          contentText: article.contentText,
          feedTitle: article.feed.title,
          summary: article.summary,
          title: article.title,
        },
        excludeTerms: rule.excludeTerms,
        includeTerms: rule.includeTerms,
      })

      return { article, result }
    })
    .filter((entry: any) => entry.result.matched)
    .slice(0, 50)
  const status = matches.length ? "COMPLETED" : "COMPLETED_NO_MATCHES"
  const emailStatus = rule.emailEnabled && matches.length ? "PENDING" : "NOT_REQUESTED"
  const digest = await store.smartDigest.create({
    data: {
      articleCount: matches.length,
      completedAt: generatedAt,
      emailStatus,
      items: {
        create: matches.map((entry: any, position: number) => ({
          articleId: entry.article.id,
          articleTitle: entry.article.title,
          articleUrl: entry.article.url,
          feedTitle: entry.article.feed.title,
          matchedFields: entry.result.matchedFields,
          matchedTerms: entry.result.matchedTerms,
          position,
          publishedAt: entry.article.publishedAt,
          reason: entry.result.reason,
          summary: summarizeArticle(entry.article),
        })),
      },
      ruleId: rule.id,
      startedAt: generatedAt,
      status,
      title: `${rule.name} - ${generatedAt.toISOString().slice(0, 10)}`,
      topicPrompt: rule.topicPrompt,
      userId: rule.userId,
    },
    include: { items: true },
  })

  await store.smartDigestRule.update({
    data: {
      lastMatchedAt: matches.length ? generatedAt : rule.lastMatchedAt,
      lastRunAt: generatedAt,
      nextRunAt,
    },
    where: { id: rule.id },
  })

  if (rule.emailEnabled && matches.length) {
    try {
      await sendDigestEmail({
        digest,
        to: rule.user.email,
      })
      await store.smartDigest.update({
        data: { emailedAt: generatedAt, emailStatus: "SENT" },
        where: { id: digest.id },
      })
    } catch {
      await store.smartDigest.update({
        data: {
          emailErrorMessage: "Smart Digest email delivery failed.",
          emailStatus: "FAILED",
        },
        where: { id: digest.id },
      })
    }
  }

  return {
    articleCount: matches.length,
    digestId: digest.id,
    status,
  }
}
```

Also add `smartDigestCandidateWhere`, `summarizeArticle`, and compact text helpers in the same file. `smartDigestCandidateWhere` must branch on `ALL_FEEDS`, `FOLDERS`, and `FEEDS`.

- [ ] **Step 6: Run processing tests**

Run:

```powershell
npm test -- src/lib/smart-digest-processing.test.ts
```

Expected: PASS.

---

### Task 5: Email Delivery

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/mail.test.ts`

- [ ] **Step 1: Add Smart Digest mail types and sender**

Add near existing mail input types:

```ts
type SmartDigestEmailInput = {
  digest: {
    id: string
    items: Array<{
      articleTitle: string
      articleUrl: string
      feedTitle: string
      matchedTerms: string[]
      publishedAt: Date | null
      reason: string
      summary: string
    }>
    title: string
    topicPrompt: string
  }
  to: string
}
```

Add export:

```ts
export async function sendSmartDigestEmail({
  digest,
  to,
}: SmartDigestEmailInput): Promise<MailResult> {
  const transport = getSmtpTransport()

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Smart Digest email would be sent to ${to}`)
    }

    return { status: "not-configured" }
  }

  const grouped = groupDigestItemsByFeed(digest.items)
  const text = [
    digest.title,
    "",
    digest.topicPrompt,
    "",
    ...grouped.flatMap(([feedTitle, items]) => [
      feedTitle,
      ...items.map(
        (item) =>
          `- ${item.articleTitle}\n  ${item.summary}\n  Matched: ${item.matchedTerms.join(", ")}\n  ${item.articleUrl}`
      ),
      "",
    ]),
  ].join("\n")
  const html = [
    `<h1>${escapeHtml(digest.title)}</h1>`,
    `<p>${escapeHtml(digest.topicPrompt)}</p>`,
    ...grouped.map(
      ([feedTitle, items]) =>
        `<h2>${escapeHtml(feedTitle)}</h2><ul>${items
          .map(
            (item) =>
              `<li><p><a href="${escapeHtml(item.articleUrl)}">${escapeHtml(
                item.articleTitle
              )}</a></p><p>${escapeHtml(item.summary)}</p><p><small>Matched: ${escapeHtml(
                item.matchedTerms.join(", ")
              )}</small></p></li>`
          )
          .join("")}</ul>`
    ),
  ].join("")

  await transport.sendMail({
    from: getMailFrom(),
    html,
    subject: digest.title,
    text,
    to,
  })

  return { status: "sent" }
}
```

Add helper:

```ts
function groupDigestItemsByFeed<T extends { feedTitle: string; publishedAt: Date | null }>(
  items: T[]
) {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const existing = groups.get(item.feedTitle) ?? []
    existing.push(item)
    groups.set(item.feedTitle, existing)
  }

  return Array.from(groups.entries()).map(([feedTitle, groupedItems]) => [
    feedTitle,
    groupedItems.sort(
      (left, right) =>
        (right.publishedAt?.getTime() ?? 0) -
        (left.publishedAt?.getTime() ?? 0)
    ),
  ] as const)
}
```

- [ ] **Step 2: Add mail tests**

Extend `src/lib/mail.test.ts` with:

```ts
it("sends Smart Digest emails grouped by feed", async () => {
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com")
  vi.stubEnv("SMTP_USER", "arcticrssreader@gmail.com")
  vi.stubEnv("SMTP_PASSWORD", "app-password")

  await sendSmartDigestEmail({
    digest: {
      id: "digest-1",
      items: [
        {
          articleTitle: "Iran talks resume",
          articleUrl: "https://example.com/iran",
          feedTitle: "World Desk",
          matchedTerms: ["iran"],
          publishedAt: new Date("2026-06-30T10:00:00.000Z"),
          reason: 'Matched "iran" in title.',
          summary: "Talks resumed.",
        },
      ],
      title: "Conflict Watch - 2026-06-30",
      topicPrompt: "Iran-U.S. conflict",
    },
    to: "reader@example.com",
  })

  expect(mailerMocks.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: "Conflict Watch - 2026-06-30",
      text: expect.stringContaining("World Desk"),
      to: "reader@example.com",
    })
  )
})
```

- [ ] **Step 3: Run mail tests**

Run:

```powershell
npm test -- src/lib/mail.test.ts
```

Expected: PASS.

---

### Task 6: Worker Scheduler

**Files:**
- Modify: `worker/index.ts`

- [ ] **Step 1: Import Smart Digest queue and processor**

Add imports:

```ts
import {
  enqueueSmartDigestRule,
  SMART_DIGEST_QUEUE_NAME,
  type SmartDigestJobData,
} from "../src/lib/smart-digest-queue"
import { processSmartDigestRule } from "../src/lib/smart-digest-processing"
```

- [ ] **Step 2: Add BullMQ worker**

Add beside the AI digest worker:

```ts
const smartDigestWorker = new Worker<SmartDigestJobData>(
  SMART_DIGEST_QUEUE_NAME,
  async (job) => {
    const result = await processSmartDigestRule({
      ruleId: job.data.ruleId,
    })
    console.log(
      `[worker] generated smart digest ${result.digestId} with ${result.articleCount} articles`
    )

    return result
  },
  {
    connection: redisConnectionOptions(),
    concurrency: Number(process.env.SMART_DIGEST_CONCURRENCY ?? 2),
  }
)
```

- [ ] **Step 3: Add due-rule scheduler**

Add function:

```ts
async function enqueueDueSmartDigests() {
  const now = new Date()
  const rules = await prisma.smartDigestRule.findMany({
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      nextRunAt: true,
    },
    take: schedulerBatchSize,
    where: {
      isEnabled: true,
      nextRunAt: {
        lte: now,
      },
    },
  })

  for (const rule of rules) {
    await enqueueSmartDigestRule(rule.id)
  }

  if (rules.length) {
    console.log(`[worker] enqueued ${rules.length} due smart digests`)
  }
}
```

Update `schedulerTick` to run all three schedulers:

```ts
const [feedResult, podcastResult, smartDigestResult] = await Promise.allSettled([
  enqueueDueFeeds(),
  enqueueDuePodcasts(),
  enqueueDueSmartDigests(),
])
```

Add error logging for `smartDigestResult`.

- [ ] **Step 4: Update shutdown**

Include `smartDigestWorker.close()` in the shutdown `Promise.all`.

- [ ] **Step 5: Typecheck worker**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

---

### Task 7: Server Actions and Forms

**Files:**
- Create: `src/app/app/smart-digests/actions.ts`
- Create: `src/components/smart-digest-rule-form.tsx`
- Create: `src/components/smart-digest-rule-form.test.tsx`

- [ ] **Step 1: Add server action**

Create `src/app/app/smart-digests/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  createSmartDigestRuleForUser,
  SmartDigestError,
} from "@/lib/smart-digests"

export type SmartDigestRuleActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function createSmartDigestRuleAction(
  _previousState: SmartDigestRuleActionState,
  formData: FormData
): Promise<SmartDigestRuleActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before creating Smart Digests.",
      status: "error",
    }
  }

  try {
    const rule = await createSmartDigestRuleForUser({
      input: {
        emailEnabled: formData.has("emailEnabled"),
        excludeTerms: String(formData.get("excludeTerms") ?? ""),
        feedSubscriptionIds: formData.getAll("feedSubscriptionIds").map(String),
        folderIds: formData.getAll("folderIds").map(String),
        includeTerms: String(formData.get("includeTerms") ?? ""),
        name: String(formData.get("name") ?? ""),
        scheduledHour: Number(formData.get("scheduledHour") ?? 8),
        sourceScope: String(formData.get("sourceScope") || "ALL_FEEDS") as "ALL_FEEDS" | "FOLDERS" | "FEEDS",
        timeZone: String(formData.get("timeZone") || "UTC"),
        topicPrompt: String(formData.get("topicPrompt") ?? ""),
      },
      userId: session.user.id,
    })

    revalidatePath("/app/smart-digests")
    redirect(`/app/smart-digests/${rule.id}`)
  } catch (error) {
    if (error instanceof SmartDigestError) {
      return { message: error.message, status: "error" }
    }

    return {
      message: "Arctic RSS could not create that Smart Digest.",
      status: "error",
    }
  }
}
```

- [ ] **Step 2: Add client form**

Create `src/components/smart-digest-rule-form.tsx` with controlled source-scope fieldsets and standard form controls. Include:

```tsx
"use client"

import { useActionState } from "react"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"

import {
  createSmartDigestRuleAction,
  type SmartDigestRuleActionState,
} from "@/app/app/smart-digests/actions"
import { Button } from "@/components/ui/button"

const initialState: SmartDigestRuleActionState = {
  message: "",
  status: "idle",
}

export function SmartDigestRuleForm({
  folders,
  subscriptions,
}: {
  folders: Array<{ id: string; name: string }>
  subscriptions: Array<{ feed: { title: string }; id: string }>
}) {
  const [state, formAction, pending] = useActionState(
    createSmartDigestRuleAction,
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <label className="grid gap-2">
        <span className="text-sm font-medium">Digest name</span>
        <input className="rounded-md border bg-background px-3 py-2 text-sm" name="name" required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Topic</span>
        <textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" name="topicPrompt" required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Include terms</span>
        <textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" name="includeTerms" placeholder={'"Iran-U.S. conflict" sanctions nuclear'} required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Exclude terms</span>
        <textarea className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm" name="excludeTerms" placeholder="sports entertainment" />
      </label>
      <fieldset className="grid gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Sources</legend>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked name="sourceScope" type="radio" value="ALL_FEEDS" />
          All active feeds
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="sourceScope" type="radio" value="FOLDERS" />
          Selected folders
        </label>
        <div className="grid gap-1 pl-6">
          {folders.map((folder) => (
            <label className="flex items-center gap-2 text-sm" key={folder.id}>
              <input name="folderIds" type="checkbox" value={folder.id} />
              {folder.name}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="sourceScope" type="radio" value="FEEDS" />
          Selected feeds
        </label>
        <div className="grid gap-1 pl-6">
          {subscriptions.map((subscription) => (
            <label className="flex items-center gap-2 text-sm" key={subscription.id}>
              <input name="feedSubscriptionIds" type="checkbox" value={subscription.id} />
              {subscription.feed.title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Delivery hour</span>
          <input className="rounded-md border bg-background px-3 py-2 text-sm" defaultValue={8} max={23} min={0} name="scheduledHour" type="number" />
        </label>
        <input name="timeZone" type="hidden" value="UTC" />
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="emailEnabled" type="checkbox" />
          Email matching digests
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
          {pending ? "Saving" : "Create Smart Digest"}
        </Button>
        {state.message && <p className="text-sm text-destructive">{state.message}</p>}
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Add form render test**

Assert the rendered markup contains `Include terms`, `Exclude terms`, `All active feeds`, `Selected folders`, `Selected feeds`, and `Email matching digests`.

- [ ] **Step 4: Run form test**

Run:

```powershell
npm test -- src/components/smart-digest-rule-form.test.tsx
```

Expected: PASS.

---

### Task 8: Pages and Detail Views

**Files:**
- Create: `src/components/smart-digest-rule-list.tsx`
- Create: `src/components/smart-digest-detail.tsx`
- Create: `src/app/app/smart-digests/page.tsx`
- Create: `src/app/app/smart-digests/new/page.tsx`
- Create: `src/app/app/smart-digests/[ruleId]/page.tsx`
- Create: `src/app/app/smart-digests/digests/[digestId]/page.tsx`
- Create tests beside the new pages/components.

- [ ] **Step 1: Rule list component**

Create `SmartDigestRuleList` that accepts rules from `listSmartDigestRulesForUser` and displays name, topic, enabled state, email state, next run, and latest digest link.

Use links:

```tsx
href={`/app/smart-digests/${rule.id}`}
href={`/app/smart-digests/digests/${latestDigest.id}`}
```

- [ ] **Step 2: Dashboard page**

Create `src/app/app/smart-digests/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { PlusIcon, SparklesIcon } from "lucide-react"

import { auth } from "@/auth"
import { SmartDigestRuleList } from "@/components/smart-digest-rule-list"
import { buttonVariants } from "@/components/ui/button"
import { listSmartDigestRulesForUser } from "@/lib/smart-digests"
import { cn } from "@/lib/utils"

export default async function SmartDigestsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const rules = await listSmartDigestRulesForUser(session.user.id)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">Smart Digests</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Watch selected feeds for specific topics and receive scheduled briefings.
          </p>
        </div>
        <Link className={cn(buttonVariants(), "gap-2")} href="/app/smart-digests/new">
          <PlusIcon data-icon="inline-start" />
          Create digest
        </Link>
      </section>
      <SmartDigestRuleList rules={rules} />
    </div>
  )
}
```

- [ ] **Step 3: New rule page**

Create page that loads `listSmartDigestSourceOptions(session.user.id)` and renders `SmartDigestRuleForm`.

- [ ] **Step 4: Detail components**

Create generated digest detail as a stacked set of bordered sections. The top section shows digest status, topic prompt, generated date, and email status. The article sections are grouped by feed title with newest articles first. Show:

- Status.
- Topic prompt.
- Email status.
- Matched terms.
- Match reason.
- Original article link.
- In-app article link when `articleId` is present.

- [ ] **Step 5: Page tests**

Add tests that mock `auth`, service functions, and render:

- Dashboard title and create link.
- Empty rule list copy.
- New form fields.
- Digest detail with matched terms and email status.

Run:

```powershell
npm test -- src/app/app/smart-digests/page.test.tsx src/app/app/smart-digests/new/page.test.tsx src/components/smart-digest-detail.test.tsx
```

Expected: PASS.

---

### Task 9: Navigation

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/app-shell.test.tsx`

- [ ] **Step 1: Add nav item**

In `primaryNav`, add after AI Summaries:

```ts
{ count: 0, href: "/app/smart-digests", label: "Smart Digests", icon: SparklesIcon },
```

Keep `/app/ai` available as `AI Summaries` so current summary workflows remain reachable.

- [ ] **Step 2: Update shell tests**

Extend current app shell tests to assert:

```ts
expect(markup).toContain('href="/app/smart-digests"')
expect(markup).toContain(">Smart Digests<")
```

- [ ] **Step 3: Run shell tests**

Run:

```powershell
npm test -- src/components/app-shell.test.tsx
```

Expected: PASS.

---

### Task 10: End-to-End Verification and Deploy

**Files:**
- No source files unless verification finds a bug.

- [ ] **Step 1: Run local verification**

Run:

```powershell
npm run prisma:generate
npm test
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Create clean source archive**

Run from the parent workspace:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\jrock\Documents\Codex\2026-06-26\we-are-continuing-work-on-arctic\work\deploy" | Out-Null
tar --exclude=.env --exclude=node_modules --exclude=.next --exclude=tmp --exclude=OPML --exclude=*.opml --exclude=*.tar.gz -czf "C:\Users\jrock\Documents\Codex\2026-06-26\we-are-continuing-work-on-arctic\work\deploy\arctic-rss-source.tar.gz" -C "C:\Users\jrock\Documents\Codex\2026-06-26\we-are-continuing-work-on-arctic\arctic-rss" .
```

- [ ] **Step 3: Upload archive**

Run:

```powershell
scp -i "<private-ssh-key-path>" "<release-archive-path>" deploy@VPS_HOST:$APP_DIR/arctic-rss-source.tar.gz
```

- [ ] **Step 4: Deploy preserving `.env`**

Run:

```powershell
ssh -i "<private-ssh-key-path>" deploy@VPS_HOST "Use the reviewed archive deployment runbook; do not delete previous releases inline."
```

Expected: Docker Compose services show healthy/running, health endpoint returns status `ok`.

- [ ] **Step 5: Smoke check production**

Open `https://arcticrss.com/app/smart-digests` in a logged-in browser. Confirm:

- Left nav shows Smart Digests.
- Create form loads.
- A rule can be created with all feeds.
- A generated digest page displays after the worker runs.
- Email status is recorded without exposing SMTP details.

---

## Self-Review

- Spec coverage: The plan covers dedicated schema, deterministic matching, in-app archive, optional email, worker scheduling, free/admin limits, UI, tests, and deploy verification.
- Placeholder scan: No `TBD`, `TODO`, or intentionally blank sections remain.
- Type consistency: The plan uses `SmartDigestRule`, `SmartDigest`, `SmartDigestItem`, `SmartDigestMatchingMode`, `SmartDigestSourceScope`, `SmartDigestCadence`, `SmartDigestStatus`, and `SmartDigestEmailStatus` consistently across schema, services, queue, worker, and UI.
