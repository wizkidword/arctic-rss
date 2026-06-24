import Link from "next/link"
import {
  ActivityIcon,
  ArrowLeftIcon,
  BotIcon,
  CircleAlertIcon,
  CoinsIcon,
  DatabaseIcon,
  FileWarningIcon,
  GaugeIcon,
  RssIcon,
  ServerCogIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { AdminDashboardData } from "@/lib/admin-dashboard"
import type { AdminQueueSnapshot } from "@/lib/admin-queues"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

const integerFormatter = new Intl.NumberFormat("en-US")

const costFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 6,
  minimumFractionDigits: 4,
  style: "currency",
})

export function AdminDashboard({
  dashboard,
  queues,
}: {
  dashboard: AdminDashboardData
  queues: AdminQueueSnapshot
}) {
  const metrics = [
    {
      detail: `${dashboard.overview.activeUserCount} active of ${dashboard.overview.userCount} total`,
      icon: UsersIcon,
      label: "Users",
      value: integerFormatter.format(dashboard.overview.userCount),
    },
    {
      detail: `${dashboard.overview.failingFeedCount} failing`,
      icon: RssIcon,
      label: "Feeds",
      value: integerFormatter.format(dashboard.overview.feedCount),
    },
    {
      detail: "Stored entries",
      icon: DatabaseIcon,
      label: "Articles",
      value: integerFormatter.format(dashboard.overview.articleCount),
    },
    {
      detail: "Active subscriptions",
      icon: ActivityIcon,
      label: "Subscriptions",
      value: integerFormatter.format(
        dashboard.overview.activeSubscriptionCount
      ),
    },
    {
      detail: "Current UTC month",
      icon: BotIcon,
      label: "AI requests",
      value: integerFormatter.format(dashboard.aiUsage.requestCount),
    },
    {
      detail: "Estimated current-month cost",
      icon: CoinsIcon,
      label: "AI cost",
      value: costFormatter.format(dashboard.aiUsage.costEstimate),
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ServerCogIcon className="size-5 text-muted-foreground" />
              <h1 className="font-heading text-xl font-semibold">
                Admin Dashboard
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated {dateFormatter.format(dashboard.generatedAt)}
            </p>
          </div>
          <Link
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-fit gap-1.5"
            )}
            href="/app"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back to reader
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-3 sm:p-5 lg:p-6">
        <section
          aria-label="Application overview"
          className="overflow-hidden rounded-lg border bg-card"
        >
          <div className="grid sm:grid-cols-2 xl:grid-cols-6">
            {metrics.map((metric, index) => (
              <div
                className={cn(
                  "min-w-0 p-4",
                  index > 0 && "border-t sm:border-t-0 sm:border-l",
                  index === 2 && "sm:border-l-0 xl:border-l",
                  index === 4 && "sm:border-l-0 xl:border-l",
                  index >= 2 && "sm:border-t xl:border-t-0"
                )}
                key={metric.label}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <metric.icon className="size-3.5" />
                  <span>{metric.label}</span>
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border bg-card">
          <SectionHeader
            badge={`${dashboard.users.length} shown`}
            icon={UsersIcon}
            title="Users"
          />
          {dashboard.users.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <TableHeading>User</TableHeading>
                    <TableHeading>Access</TableHeading>
                    <TableHeading>Subscriptions</TableHeading>
                    <TableHeading>AI usage</TableHeading>
                    <TableHeading>Joined</TableHeading>
                    <TableHeading>Status</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dashboard.users.map((user) => (
                    <tr key={user.id}>
                      <TableCell>
                        <p className="font-medium">
                          {user.name || "Unnamed reader"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">{user.role}</Badge>
                          <Badge variant="secondary">{user.plan}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {integerFormatter.format(user.subscriptionCount)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {integerFormatter.format(user.aiMonthlyUsed)}
                        <span className="text-muted-foreground">
                          {" "}
                          / {integerFormatter.format(user.aiMonthlyLimit)}
                        </span>
                      </TableCell>
                      <TableCell>{dateFormatter.format(user.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.disabledAt ? "destructive" : "outline"}
                        >
                          {user.disabledAt ? "Disabled" : "Active"}
                        </Badge>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No users found" />
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="overflow-hidden rounded-lg border bg-card">
            <SectionHeader
              badge={`${dashboard.feedHealth.failingCount} failing · ${dashboard.feedHealth.staleCount} stale`}
              icon={RssIcon}
              title="Feed health"
              variant={
                dashboard.feedHealth.failingCount ? "destructive" : "outline"
              }
            />
            {dashboard.feedHealth.failingFeeds.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <TableHeading>Feed</TableHeading>
                      <TableHeading>Subscribers</TableHeading>
                      <TableHeading>Last success</TableHeading>
                      <TableHeading>Last failure</TableHeading>
                      <TableHeading>Error</TableHeading>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dashboard.feedHealth.failingFeeds.map((feed) => (
                      <tr key={feed.id}>
                        <TableCell className="max-w-64">
                          <p className="truncate font-medium">{feed.title}</p>
                          <a
                            className="mt-0.5 block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                            href={feed.feedUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {feed.feedUrl}
                          </a>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {integerFormatter.format(feed.subscriberCount)}
                        </TableCell>
                        <TableCell>
                          {formatOptionalDate(feed.lastSuccessfulFetchAt)}
                        </TableCell>
                        <TableCell>
                          {formatOptionalDate(feed.lastFailedAt)}
                        </TableCell>
                        <TableCell className="max-w-80 text-destructive">
                          <span className="line-clamp-2">{feed.lastError}</span>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={ActivityIcon}
                message="No failing feeds"
              />
            )}
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <SectionHeader icon={GaugeIcon} title="Queue status" />
            {queues.available ? (
              <div className="divide-y">
                {queues.queues.map((queue) => (
                  <div className="p-4" key={queue.name}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{queue.name}</p>
                      <Badge
                        variant={queue.failed ? "destructive" : "outline"}
                      >
                        {queue.failed} failed
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <QueueCount label="Waiting" value={queue.waiting} />
                      <QueueCount label="Active" value={queue.active} />
                      <QueueCount label="Delayed" value={queue.delayed} />
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CircleAlertIcon}
                message={queues.error}
                destructive
              />
            )}
          </section>
        </div>

        <section className="overflow-hidden rounded-lg border bg-card">
          <SectionHeader
            badge={`${dashboard.aiUsage.requestCount} requests`}
            icon={BotIcon}
            title="AI usage"
          />
          <div className="grid border-b sm:grid-cols-2 xl:grid-cols-4">
            <AiMetric
              label="Input tokens"
              value={integerFormatter.format(dashboard.aiUsage.inputTokens)}
            />
            <AiMetric
              label="Output tokens"
              value={integerFormatter.format(dashboard.aiUsage.outputTokens)}
            />
            <AiMetric
              label="Estimated cost"
              value={costFormatter.format(dashboard.aiUsage.costEstimate)}
            />
            <AiMetric
              label="Month begins"
              value={dateFormatter.format(dashboard.aiUsage.monthStart)}
            />
          </div>

          {dashboard.aiUsage.byAction.length ||
          dashboard.aiUsage.byProviderModel.length ? (
            <div className="grid xl:grid-cols-2">
              <BreakdownTable
                rows={dashboard.aiUsage.byAction.map((group) => ({
                  cost: group.costEstimate,
                  label: humanizeEnum(group.action),
                  requests: group.requestCount,
                  tokens: group.inputTokens + group.outputTokens,
                }))}
                title="By action"
              />
              <BreakdownTable
                className="border-t xl:border-t-0 xl:border-l"
                rows={dashboard.aiUsage.byProviderModel.map((group) => ({
                  cost: group.costEstimate,
                  label: `${group.provider} · ${group.model}`,
                  requests: group.requestCount,
                  tokens: group.inputTokens + group.outputTokens,
                }))}
                title="By provider and model"
              />
            </div>
          ) : (
            <EmptyState icon={BotIcon} message="No AI requests this month" />
          )}

          {dashboard.aiUsage.recent.length > 0 && (
            <div className="border-t">
              <div className="border-b px-4 py-3">
                <h3 className="font-heading text-sm font-medium">
                  Recent AI requests
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <TableHeading>User</TableHeading>
                      <TableHeading>Action</TableHeading>
                      <TableHeading>Provider</TableHeading>
                      <TableHeading>Tokens</TableHeading>
                      <TableHeading>Cost</TableHeading>
                      <TableHeading>Time</TableHeading>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dashboard.aiUsage.recent.map((usage) => (
                      <tr key={usage.id}>
                        <TableCell>{usage.userEmail}</TableCell>
                        <TableCell>{humanizeEnum(usage.action)}</TableCell>
                        <TableCell>
                          {usage.provider} · {usage.model}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {integerFormatter.format(
                            usage.inputTokens + usage.outputTokens
                          )}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {costFormatter.format(usage.costEstimate)}
                        </TableCell>
                        <TableCell>
                          {dateFormatter.format(usage.createdAt)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border bg-card">
          <SectionHeader icon={FileWarningIcon} title="Failed jobs" />
          <div className="grid xl:grid-cols-2">
            <FailureList
              emptyMessage="No persisted failures"
              failures={dashboard.persistedFailures.map((failure) => ({
                detail: failure.userEmail,
                id: `${failure.type}-${failure.id}`,
                message: failure.message,
                occurredAt: failure.occurredAt,
                title: failure.type,
              }))}
              title="Persisted failures"
            />
            <div className="border-t xl:border-t-0 xl:border-l">
              {queues.available ? (
                <FailureList
                  emptyMessage="No failed queue jobs"
                  failures={queues.failedJobs.map((job) => ({
                    detail: `${job.jobName} · ${job.attemptsMade} attempts`,
                    id: `${job.queueName}-${job.id}`,
                    message: job.failedReason,
                    occurredAt: job.occurredAt,
                    title: job.queueName,
                  }))}
                  title="Queue failures"
                />
              ) : (
                <>
                  <div className="border-b px-4 py-3">
                    <h3 className="font-heading text-sm font-medium">
                      Queue failures
                    </h3>
                  </div>
                  <EmptyState
                    icon={CircleAlertIcon}
                    message={queues.error}
                    destructive
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function SectionHeader({
  badge,
  icon: Icon,
  title,
  variant = "secondary",
}: {
  badge?: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  variant?: "secondary" | "destructive" | "outline"
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="truncate font-heading text-base font-medium">{title}</h2>
      </div>
      {badge && <Badge variant={variant}>{badge}</Badge>}
    </div>
  )
}

function TableHeading({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-medium" scope="col">
      {children}
    </th>
  )
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>
}

function QueueCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
        {integerFormatter.format(value)}
      </dd>
    </div>
  )
}

function AiMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t p-4 first:border-t-0 sm:odd:border-r sm:nth-[2]:border-t-0 xl:border-t-0 xl:border-r xl:last:border-r-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-mono text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  )
}

function BreakdownTable({
  className,
  rows,
  title,
}: {
  className?: string
  rows: Array<{
    cost: number
    label: string
    requests: number
    tokens: number
  }>
  title: string
}) {
  return (
    <div className={className}>
      <div className="border-b px-4 py-3">
        <h3 className="font-heading text-sm font-medium">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <TableHeading>Group</TableHeading>
              <TableHeading>Requests</TableHeading>
              <TableHeading>Tokens</TableHeading>
              <TableHeading>Cost</TableHeading>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {integerFormatter.format(row.requests)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {integerFormatter.format(row.tokens)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {costFormatter.format(row.cost)}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FailureList({
  emptyMessage,
  failures,
  title,
}: {
  emptyMessage: string
  failures: Array<{
    detail: string
    id: string
    message: string
    occurredAt: Date
    title: string
  }>
  title: string
}) {
  return (
    <div>
      <div className="border-b px-4 py-3">
        <h3 className="font-heading text-sm font-medium">{title}</h3>
      </div>
      {failures.length ? (
        <div className="divide-y">
          {failures.map((failure) => (
            <article className="p-4" key={failure.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{failure.title}</Badge>
                <span className="text-xs text-muted-foreground">
                  {failure.detail}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-destructive">
                {failure.message}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateFormatter.format(failure.occurredAt)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </div>
  )
}

function EmptyState({
  destructive = false,
  icon: Icon = CircleAlertIcon,
  message,
}: {
  destructive?: boolean
  icon?: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-28 items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground",
        destructive && "text-destructive"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function formatOptionalDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "Never"
}

function humanizeEnum(value: string) {
  const normalized = value.replace(/_/g, " ").toLowerCase()

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
