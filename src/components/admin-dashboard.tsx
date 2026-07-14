import Link from "next/link"
import { Suspense } from "react"
import {
  ActivityIcon,
  ArrowLeftIcon,
  BotIcon,
  BugIcon,
  CircleAlertIcon,
  DatabaseIcon,
  FileUpIcon,
  FileWarningIcon,
  GaugeIcon,
  HashIcon,
  LightbulbIcon,
  PaletteIcon,
  RssIcon,
  ServerCogIcon,
  UsersIcon,
} from "lucide-react"

import { AdminDiscoverCategoryMetadataForm } from "@/components/admin-discover-category-metadata-form"
import { AdminDiscoverImportForm } from "@/components/admin-discover-import-form"
import { AdminDiscoverSubredditForm } from "@/components/admin-discover-subreddit-form"
import { AdminRevokeSessionsButton } from "@/components/admin-revoke-sessions-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  getAdminDashboardAiUsage,
  getAdminDashboardFeedHealth,
  getAdminDashboardFeedback,
  getAdminDashboardOverview,
  getAdminDashboardPersistedFailures,
  getAdminDashboardUsers,
  type AdminDashboardData,
  type AdminDashboardFilters,
  type AdminDashboardPagination,
} from "@/lib/admin-dashboard"
import { inspectAdminQueues, type AdminQueueSnapshot } from "@/lib/admin-queues"
import { isChatEnabled } from "@/lib/chat/feature-flags"
import { listDiscoverCategoryEditorOptions, type DiscoverCategoryEditorOption } from "@/lib/discover-category-customizations"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

const dateOnlyFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
})

const integerFormatter = new Intl.NumberFormat("en-US")

const costFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 6,
  minimumFractionDigits: 4,
  style: "currency",
})

type FeedbackRecord = AdminDashboardData["bugReports"][number]
type FeedHealthData = Awaited<ReturnType<typeof getAdminDashboardFeedHealth>>
type AiUsageData = Awaited<ReturnType<typeof getAdminDashboardAiUsage>>

export function AdminDashboard({ filters }: { filters: AdminDashboardFilters }) {
  return (
    <DashboardFrame generatedAt={new Date()}>
      <DateRangeFilter filters={filters} />

      <Suspense fallback={<LoadingPanel label="Loading overview" />}>
        <OverviewPanel />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading Discover tools" />}>
        <DiscoverPanel />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading users" />}>
        <UsersPanel filters={filters} />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading feed health" />}>
        <FeedHealthPanel filters={filters} />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading reader feedback" />}>
        <FeedbackPanel filters={filters} />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading AI usage" />}>
        <AiUsagePanel filters={filters} />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Loading operational status" />}>
        <OperationsPanel filters={filters} />
      </Suspense>
    </DashboardFrame>
  )
}

// This data-only variant keeps the visual sections directly testable without
// bypassing the fresh-admin gate used by the real page above.
export function AdminDashboardSnapshot({
  dashboard,
  discoverCategories,
  queues,
}: {
  dashboard: AdminDashboardData
  discoverCategories: DiscoverCategoryEditorOption[]
  queues: AdminQueueSnapshot
}) {
  return (
    <DashboardFrame generatedAt={dashboard.generatedAt}>
      <OverviewSection overview={dashboard.overview} />
      <DiscoverSection categories={discoverCategories} />
      <UsersSection users={dashboard.users} />
      <FeedHealthSection feedHealth={dashboard.feedHealth} />
      <FeedbackSection reports={dashboard.bugReports} title="Bug reports" type="bug" />
      <FeedbackSection
        reports={dashboard.featureSuggestions}
        title="Feature suggestions"
        type="suggestion"
      />
      <AiUsageSection
        usage={{
          ...dashboard.aiUsage,
          rangeEnd: dashboard.generatedAt,
          rangeStart: dashboard.aiUsage.monthStart,
        }}
      />
      <QueueStatusSection queues={queues} />
      <FailuresSection failures={dashboard.persistedFailures} queues={queues} />
    </DashboardFrame>
  )
}

async function OverviewPanel() {
  const { overview } = await getAdminDashboardOverview()

  return <OverviewSection overview={overview} />
}

async function DiscoverPanel() {
  const categories = await listDiscoverCategoryEditorOptions()

  return <DiscoverSection categories={categories} />
}

async function UsersPanel({ filters }: { filters: AdminDashboardFilters }) {
  const { pagination, users } = await getAdminDashboardUsers({
    page: filters.usersPage,
  })

  return (
    <UsersSection
      filters={filters}
      pagination={pagination}
      users={users}
    />
  )
}

async function FeedHealthPanel({ filters }: { filters: AdminDashboardFilters }) {
  const feedHealth = await getAdminDashboardFeedHealth({ page: filters.feedsPage })

  return (
    <FeedHealthSection
      feedHealth={feedHealth}
      filters={filters}
      pagination={feedHealth.pagination}
    />
  )
}

async function FeedbackPanel({ filters }: { filters: AdminDashboardFilters }) {
  const feedback = await getAdminDashboardFeedback({ filters })

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <FeedbackSection
        filters={filters}
        pagination={feedback.bugReports.pagination}
        reports={feedback.bugReports.items}
        title="Bug reports"
        type="bug"
      />
      <FeedbackSection
        filters={filters}
        pagination={feedback.featureSuggestions.pagination}
        reports={feedback.featureSuggestions.items}
        title="Feature suggestions"
        type="suggestion"
      />
    </div>
  )
}

async function AiUsagePanel({ filters }: { filters: AdminDashboardFilters }) {
  const usage = await getAdminDashboardAiUsage({ filters })

  return <AiUsageSection usage={usage} />
}

async function OperationsPanel({ filters }: { filters: AdminDashboardFilters }) {
  const [failures, queues] = await Promise.all([
    getAdminDashboardPersistedFailures({ filters }),
    inspectAdminQueues(),
  ])

  return (
    <>
      <QueueStatusSection queues={queues} />
      <FailuresSection failures={failures} queues={queues} />
    </>
  )
}

function DashboardFrame({
  children,
  generatedAt,
}: {
  children: React.ReactNode
  generatedAt: Date
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ServerCogIcon className="size-5 text-muted-foreground" />
              <h1 className="font-heading text-xl font-semibold">Admin Dashboard</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Loaded {formatDateTime(generatedAt)} · panels update independently
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isChatEnabled() ? <>
              <Link className={cn(buttonVariants({ variant: "outline" }), "w-fit")} href="/admin/chat-reports">Chat reports</Link>
              <Link className={cn(buttonVariants({ variant: "outline" }), "w-fit")} href="/admin/chat-legal-holds">Legal holds</Link>
            </> : null}
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-fit gap-1.5")}
              href="/app"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to reader
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-3 sm:p-5 lg:p-6">
        {children}
      </div>
    </main>
  )
}

export function DateRangeFilter({ filters }: { filters: AdminDashboardFilters }) {
  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Activity date range">
      <form action="/admin" className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="admin-from">
            Activity from
          </label>
          <input
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
            defaultValue={filters.from}
            id="admin-from"
            max={filters.to}
            name="from"
            type="date"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="admin-to">
            Activity through
          </label>
          <input
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
            defaultValue={filters.to}
            id="admin-to"
            min={filters.from}
            name="to"
            type="date"
          />
        </div>
        <div className="min-w-56 flex-1">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="admin-feedback-search">
            Search reader feedback
          </label>
          <input
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
            defaultValue={filters.feedbackSearch}
            id="admin-feedback-search"
            maxLength={120}
            name="feedbackSearch"
            placeholder="Report, reader, page, or browser"
            type="search"
          />
        </div>
        <button className={buttonVariants({ variant: "outline" })} type="submit">
          Apply filters
        </button>
        <p className="max-w-xl text-xs text-muted-foreground">
          The range applies to AI activity, reader feedback, and recorded failures. Feedback search matches report text and captured reader details. The range is capped at one year to keep operational reports quick.
        </p>
      </form>
    </section>
  )
}

function OverviewSection({ overview }: { overview: AdminDashboardData["overview"] }) {
  const metrics = [
    {
      detail: `${overview.activeUserCount} active of ${overview.userCount} total`,
      icon: UsersIcon,
      label: "Users",
      value: integerFormatter.format(overview.userCount),
    },
    {
      detail: `${overview.failingFeedCount} failing`,
      icon: RssIcon,
      label: "Feeds",
      value: integerFormatter.format(overview.feedCount),
    },
    {
      detail: "Stored entries",
      icon: DatabaseIcon,
      label: "Articles",
      value: integerFormatter.format(overview.articleCount),
    },
    {
      detail: "Active subscriptions",
      icon: ActivityIcon,
      label: "Subscriptions",
      value: integerFormatter.format(overview.activeSubscriptionCount),
    },
  ]

  return (
    <section aria-label="Application overview" className="overflow-hidden rounded-lg border bg-card">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            className={cn(
              "min-w-0 p-4",
              index > 0 && "border-t sm:border-t-0 sm:border-l",
              index === 2 && "sm:border-l-0 xl:border-l",
              index >= 2 && "sm:border-t xl:border-t-0",
            )}
            key={metric.label}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <metric.icon className="size-3.5" />
              <span>{metric.label}</span>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function DiscoverSection({ categories }: { categories: DiscoverCategoryEditorOption[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="overflow-hidden rounded-lg border bg-card">
        <SectionHeader badge="OPML" icon={FileUpIcon} title="Import OPML into Discover" />
        <AdminDiscoverImportForm />
      </section>
      <section className="overflow-hidden rounded-lg border bg-card">
        <SectionHeader badge="Reddit" icon={HashIcon} title="Add Subreddit to Discover" />
        <AdminDiscoverSubredditForm />
      </section>
      <section className="overflow-hidden rounded-lg border bg-card">
        <SectionHeader badge={`${categories.length} cards`} icon={PaletteIcon} title="Edit Discover Cards" />
        <AdminDiscoverCategoryMetadataForm categories={categories} />
      </section>
    </div>
  )
}

function UsersSection({
  filters,
  pagination,
  users,
}: {
  filters?: AdminDashboardFilters
  pagination?: AdminDashboardPagination
  users: AdminDashboardData["users"]
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader badge={`${users.length} shown`} icon={UsersIcon} title="Users" />
      {users.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <TableHeading>User</TableHeading><TableHeading>Access</TableHeading><TableHeading>Subscriptions</TableHeading><TableHeading>AI usage</TableHeading><TableHeading>Joined</TableHeading><TableHeading>Last logged in</TableHeading><TableHeading>Status</TableHeading><TableHeading>Sessions</TableHeading>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id}>
                  <TableCell><p className="font-medium">{user.name || "Unnamed reader"}</p><p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><Badge variant="outline">{user.role}</Badge><Badge variant="secondary">{user.plan}</Badge></div></TableCell>
                  <TableCell className="font-mono tabular-nums">{integerFormatter.format(user.subscriptionCount)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{integerFormatter.format(user.aiMonthlyUsed)}<span className="text-muted-foreground"> / {integerFormatter.format(user.aiMonthlyLimit)}</span></TableCell>
                  <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                  <TableCell>{formatLastLogin(user.lastLoginAt)}</TableCell>
                  <TableCell><Badge variant={user.disabledAt ? "destructive" : "outline"}>{user.disabledAt ? "Disabled" : "Active"}</Badge></TableCell>
                  <TableCell><AdminRevokeSessionsButton userId={user.id} /></TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="No users found" />}
      {filters && pagination ? <PaginationNav filters={filters} label="users" pageKey="usersPage" pagination={pagination} /> : null}
    </section>
  )
}

function FeedHealthSection({
  feedHealth,
  filters,
  pagination,
}: {
  feedHealth: FeedHealthData | AdminDashboardData["feedHealth"]
  filters?: AdminDashboardFilters
  pagination?: AdminDashboardPagination
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader
        badge={`${feedHealth.failingCount} failing · ${feedHealth.staleCount} stale`}
        icon={RssIcon}
        title="Feed health"
        variant={feedHealth.failingCount ? "destructive" : "outline"}
      />
      {feedHealth.failingFeeds.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><TableHeading>Feed</TableHeading><TableHeading>Subscribers</TableHeading><TableHeading>Last success</TableHeading><TableHeading>Last failure</TableHeading><TableHeading>Error</TableHeading></tr></thead>
            <tbody className="divide-y">
              {feedHealth.failingFeeds.map((feed) => (
                <tr key={feed.id}>
                  <TableCell className="max-w-64"><p className="truncate font-medium">{feed.title}</p><a className="mt-0.5 block truncate text-xs text-muted-foreground underline-offset-4 hover:underline" href={feed.feedUrl} rel="noreferrer" target="_blank">{feed.feedUrl}</a></TableCell>
                  <TableCell className="font-mono tabular-nums">{integerFormatter.format(feed.subscriberCount)}</TableCell>
                  <TableCell>{formatOptionalDate(feed.lastSuccessfulFetchAt)}</TableCell>
                  <TableCell>{formatOptionalDate(feed.lastFailedAt)}</TableCell>
                  <TableCell className="max-w-80 text-destructive"><span className="line-clamp-2">{feed.lastError}</span></TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={ActivityIcon} message="No failing feeds" />}
      {filters && pagination ? <PaginationNav filters={filters} label="failing feeds" pageKey="feedsPage" pagination={pagination} /> : null}
    </section>
  )
}

function FeedbackSection({
  filters,
  pagination,
  reports,
  title,
  type,
}: {
  filters?: AdminDashboardFilters
  pagination?: AdminDashboardPagination
  reports: FeedbackRecord[]
  title: "Bug reports" | "Feature suggestions"
  type: "bug" | "suggestion"
}) {
  const icon = type === "bug" ? BugIcon : LightbulbIcon
  const emptyMessage = type === "bug" ? "No bug reports" : "No feature suggestions"
  const pageKey = type === "bug" ? "bugReportsPage" : "featureSuggestionsPage"

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader badge={`${reports.length} shown`} icon={icon} title={title} />
      {reports.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><TableHeading>{type === "bug" ? "Report" : "Suggestion"}</TableHeading><TableHeading>Reader</TableHeading><TableHeading>Page</TableHeading><TableHeading>Browser</TableHeading><TableHeading>Status</TableHeading><TableHeading>Sent</TableHeading></tr></thead>
            <tbody className="divide-y">
              {reports.map((report) => <FeedbackRow key={report.id} report={report} />)}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={icon} message={emptyMessage} />}
      {filters && pagination ? <PaginationNav filters={filters} label={title.toLowerCase()} pageKey={pageKey} pagination={pagination} /> : null}
    </section>
  )
}

function FeedbackRow({ report }: { report: FeedbackRecord }) {
  return (
    <tr>
      <TableCell className="max-w-96"><p className="font-medium">{report.title}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{report.description}</p></TableCell>
      <TableCell><p>{report.userEmail}</p>{report.contactEmail && report.contactEmail !== report.userEmail ? <p className="mt-0.5 text-xs text-muted-foreground">{report.contactEmail}</p> : null}</TableCell>
      <TableCell className="max-w-56">{report.pageUrl ? <a className="block truncate text-xs text-muted-foreground underline-offset-4 hover:underline" href={report.pageUrl} rel="noreferrer" target="_blank">{report.pageUrl}</a> : <span className="text-xs text-muted-foreground">Not captured</span>}</TableCell>
      <TableCell className="max-w-60"><span className="line-clamp-2 text-xs text-muted-foreground">{report.userAgent || "Not captured"}</span></TableCell>
      <TableCell><Badge variant="outline">{report.status}</Badge></TableCell>
      <TableCell>{formatDateTime(report.createdAt)}</TableCell>
    </tr>
  )
}

function AiUsageSection({ usage }: { usage: AiUsageData }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader badge={`${usage.requestCount} requests`} icon={BotIcon} title="AI usage" />
      <div className="border-b px-4 py-2 text-xs text-muted-foreground">{formatDateOnly(usage.rangeStart)} through {formatDateOnly(new Date(usage.rangeEnd.getTime() - 1))}</div>
      <div className="grid border-b sm:grid-cols-2 xl:grid-cols-3">
        <AiMetric label="Input tokens" value={integerFormatter.format(usage.inputTokens)} />
        <AiMetric label="Output tokens" value={integerFormatter.format(usage.outputTokens)} />
        <AiMetric label="Estimated cost" value={costFormatter.format(usage.costEstimate)} />
      </div>
      {usage.byAction.length || usage.byProviderModel.length ? <div className="grid xl:grid-cols-2"><BreakdownTable rows={usage.byAction.map((group) => ({ cost: group.costEstimate, label: humanizeEnum(group.action), requests: group.requestCount, tokens: group.inputTokens + group.outputTokens }))} title="By action" /><BreakdownTable className="border-t xl:border-t-0 xl:border-l" rows={usage.byProviderModel.map((group) => ({ cost: group.costEstimate, label: `${group.provider} · ${group.model}`, requests: group.requestCount, tokens: group.inputTokens + group.outputTokens }))} title="By provider and model" /></div> : <EmptyState icon={BotIcon} message="No AI requests in this range" />}
      {usage.recent.length ? <div className="border-t"><div className="border-b px-4 py-3"><h3 className="font-heading text-sm font-medium">Recent AI requests</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><TableHeading>User</TableHeading><TableHeading>Action</TableHeading><TableHeading>Provider</TableHeading><TableHeading>Tokens</TableHeading><TableHeading>Cost</TableHeading><TableHeading>Time</TableHeading></tr></thead><tbody className="divide-y">{usage.recent.map((item) => <tr key={item.id}><TableCell>{item.userEmail}</TableCell><TableCell>{humanizeEnum(item.action)}</TableCell><TableCell>{item.provider} · {item.model}</TableCell><TableCell className="font-mono tabular-nums">{integerFormatter.format(item.inputTokens + item.outputTokens)}</TableCell><TableCell className="font-mono tabular-nums">{costFormatter.format(item.costEstimate)}</TableCell><TableCell>{formatDateTime(item.createdAt)}</TableCell></tr>)}</tbody></table></div></div> : null}
    </section>
  )
}

function QueueStatusSection({ queues }: { queues: AdminQueueSnapshot }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader icon={GaugeIcon} title="Queue status" />
      {queues.available ? <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">{queues.queues.map((queue) => <div className="p-4" key={queue.name}><div className="flex items-center justify-between gap-3"><p className="font-medium">{queue.name}</p><Badge variant={queue.failed ? "destructive" : "outline"}>{queue.failed} failed</Badge></div><dl className="mt-3 grid grid-cols-3 gap-3 text-xs"><QueueCount label="Waiting" value={queue.waiting} /><QueueCount label="Active" value={queue.active} /><QueueCount label="Delayed" value={queue.delayed} /></dl></div>)}</div> : <EmptyState destructive icon={CircleAlertIcon} message={queues.error} />}
    </section>
  )
}

function FailuresSection({
  failures,
  queues,
}: {
  failures: AdminDashboardData["persistedFailures"]
  queues: AdminQueueSnapshot
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <SectionHeader icon={FileWarningIcon} title="Failed jobs" />
      <div className="grid xl:grid-cols-2">
        <FailureList emptyMessage="No persisted failures" failures={failures.map((failure) => ({ detail: failure.userEmail, id: `${failure.type}-${failure.id}`, message: failure.message, occurredAt: failure.occurredAt, title: failure.type }))} title="Persisted failures" />
        <div className="border-t xl:border-t-0 xl:border-l">{queues.available ? <FailureList emptyMessage="No failed queue jobs" failures={queues.failedJobs.map((job) => ({ detail: `${job.jobName} · ${job.attemptsMade} attempts`, id: `${job.queueName}-${job.id}`, message: job.failedReason, occurredAt: job.occurredAt, title: job.queueName }))} title="Queue failures" /> : <><div className="border-b px-4 py-3"><h3 className="font-heading text-sm font-medium">Queue failures</h3></div><EmptyState destructive icon={CircleAlertIcon} message={queues.error} /></>}</div>
      </div>
    </section>
  )
}

function PaginationNav({
  filters,
  label,
  pageKey,
  pagination,
}: {
  filters: AdminDashboardFilters
  label: string
  pageKey: "bugReportsPage" | "featureSuggestionsPage" | "feedsPage" | "usersPage"
  pagination: AdminDashboardPagination
}) {
  const previous = pagination.page > 1 ? adminPageHref(filters, pageKey, pagination.page - 1) : null
  const next = pagination.hasNextPage ? adminPageHref(filters, pageKey, pagination.page + 1) : null

  return (
    <nav aria-label={`${label} pagination`} className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">Page {pagination.page}</span>
      <div className="flex gap-2">
        {previous ? <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={previous}>Previous</Link> : <span className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-events-none opacity-50")}>Previous</span>}
        {next ? <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={next}>Next</Link> : <span className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-events-none opacity-50")}>Next</span>}
      </div>
    </nav>
  )
}

export function adminPageHref(filters: AdminDashboardFilters, pageKey: string, page: number) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to })

  if (filters.feedbackSearch) {
    params.set("feedbackSearch", filters.feedbackSearch)
  }

  params.set(pageKey, String(page))

  return `/admin?${params.toString()}`
}

function LoadingPanel({ label }: { label: string }) {
  return <section aria-busy="true" className="min-h-28 rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">{label}…</section>
}

function SectionHeader({ badge, icon: Icon, title, variant = "secondary" }: { badge?: string; icon: React.ComponentType<{ className?: string }>; title: string; variant?: "secondary" | "destructive" | "outline" }) {
  return <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3"><div className="flex min-w-0 items-center gap-2"><Icon className="size-4 shrink-0 text-muted-foreground" /><h2 className="truncate font-heading text-base font-medium">{title}</h2></div>{badge ? <Badge variant={variant}>{badge}</Badge> : null}</div>
}

function TableHeading({ children }: { children: React.ReactNode }) { return <th className="px-4 py-2.5 font-medium" scope="col">{children}</th> }
function TableCell({ children, className }: { children: React.ReactNode; className?: string }) { return <td className={cn("px-4 py-3 align-top", className)}>{children}</td> }
function QueueCount({ label, value }: { label: string; value: number }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-base font-semibold tabular-nums">{integerFormatter.format(value)}</dd></div> }
function AiMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-t p-4 first:border-t-0 sm:odd:border-r sm:nth-[2]:border-t-0 xl:border-t-0 xl:border-r xl:last:border-r-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 truncate font-mono text-lg font-semibold tabular-nums">{value}</p></div> }

function BreakdownTable({ className, rows, title }: { className?: string; rows: Array<{ cost: number; label: string; requests: number; tokens: number }>; title: string }) {
  return <div className={className}><div className="border-b px-4 py-3"><h3 className="font-heading text-sm font-medium">{title}</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><TableHeading>Group</TableHeading><TableHeading>Requests</TableHeading><TableHeading>Tokens</TableHeading><TableHeading>Cost</TableHeading></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.label}><TableCell className="font-medium">{row.label}</TableCell><TableCell className="font-mono tabular-nums">{integerFormatter.format(row.requests)}</TableCell><TableCell className="font-mono tabular-nums">{integerFormatter.format(row.tokens)}</TableCell><TableCell className="font-mono tabular-nums">{costFormatter.format(row.cost)}</TableCell></tr>)}</tbody></table></div></div>
}

function FailureList({ emptyMessage, failures, title }: { emptyMessage: string; failures: Array<{ detail: string; id: string; message: string; occurredAt: Date; title: string }>; title: string }) {
  return <div><div className="border-b px-4 py-3"><h3 className="font-heading text-sm font-medium">{title}</h3></div>{failures.length ? <div className="divide-y">{failures.map((failure) => <article className="p-4" key={failure.id}><div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">{failure.title}</Badge><span className="text-xs text-muted-foreground">{failure.detail}</span></div><p className="mt-2 text-sm leading-6 text-destructive">{failure.message}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(failure.occurredAt)}</p></article>)}</div> : <EmptyState message={emptyMessage} />}</div>
}

function EmptyState({ destructive = false, icon: Icon = CircleAlertIcon, message }: { destructive?: boolean; icon?: React.ComponentType<{ className?: string }>; message: string }) {
  return <div className={cn("flex min-h-28 items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground", destructive && "text-destructive")}><Icon className="size-4 shrink-0" /><span>{message}</span></div>
}

function formatOptionalDate(value: Date | null) { return value ? formatDateTime(value) : "Never" }
function formatLastLogin(value: Date | null) { return value ? formatDateTime(value) : "Not recorded" }
function formatDateTime(value: Date | string | number | null | undefined) { const date = value instanceof Date ? value : new Date(value ?? Number.NaN); return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Unavailable" }
function formatDateOnly(value: Date | string | number | null | undefined) { const date = value instanceof Date ? value : new Date(value ?? Number.NaN); return Number.isFinite(date.getTime()) ? dateOnlyFormatter.format(date) : "Unavailable" }
function humanizeEnum(value: string) { const normalized = value.replace(/_/g, " ").toLowerCase(); return normalized.charAt(0).toUpperCase() + normalized.slice(1) }
