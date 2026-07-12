import Link from "next/link"
import { redirect } from "next/navigation"
import {
  BotIcon,
  CalendarDaysIcon,
  GaugeIcon,
  HistoryIcon,
  SparklesIcon,
} from "lucide-react"

import { auth } from "@/auth"
import { AiDigestGenerator } from "@/components/ai-digest-generator"
import { AiPreferencesForm } from "@/components/ai-preferences-form"
import { Badge } from "@/components/ui/badge"
import { getAiDashboardForUser } from "@/lib/ai-dashboard"
import { articleDetailHref } from "@/lib/reader-navigation"

const dashboardDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default async function AiPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const dashboard = await getAiDashboardForUser({
    userId: session.user.id,
  })

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">AI Summaries</h1>
            <Badge variant="secondary">
              {dashboard.summaryCount}{" "}
              {dashboard.summaryCount === 1 ? "summary" : "summaries"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review generated summaries, monthly usage, and digest candidates.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <GaugeIcon className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-base font-medium">Monthly usage</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Used</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {dashboard.usage.monthlyUsed}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {dashboard.usage.monthlyRemaining}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Limit</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {dashboard.usage.monthlyLimit}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Current cycle</span>
              <span className="font-mono tabular-nums">
                {dashboard.usage.percentUsed}%
              </span>
            </div>
            <div
              aria-label="AI monthly usage"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={dashboard.usage.percentUsed}
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${dashboard.usage.percentUsed}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <BotIcon className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-base font-medium">Preferences</h2>
          </div>
          <AiPreferencesForm {...dashboard.preferences} />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">
            Generate unread digest
          </h2>
        </div>
        <AiDigestGenerator
          activeDigest={dashboard.activeDigest}
          eligibleArticleCount={dashboard.eligibleDigestArticleCount}
        />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-muted-foreground" />
              <h2 className="font-heading text-base font-medium">
                Unread digest candidates
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent unread stories from active subscriptions.
            </p>
          </div>
          <Badge
            variant={
              dashboard.preferences.dailyDigestEnabled
                ? "secondary"
                : "outline"
            }
          >
            {dashboard.preferences.dailyDigestEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {dashboard.digestArticles.length ? (
          <div className="divide-y">
            {dashboard.digestArticles.map((article) => (
              <article
                className="grid gap-2 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                key={article.id}
              >
                <div className="min-w-0">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={articleDetailHref(article.id)}
                  >
                    {article.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {article.feedTitle}
                    {article.publishedAt
                      ? ` · ${dashboardDateFormatter.format(article.publishedAt)}`
                      : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {article.summary}
                  </p>
                </div>
                <Badge className="self-start" variant="outline">
                  Digest
                </Badge>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No stories were published by active subscriptions in the last 24
            hours.
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-4 text-muted-foreground" />
              <h2 className="font-heading text-base font-medium">
                Digest history
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored unread digests for this account.
            </p>
          </div>
          <Badge variant="secondary">{dashboard.digestHistory.length}</Badge>
        </div>

        {dashboard.digestHistory.length ? (
          <div className="divide-y">
            {dashboard.digestHistory.map((digest) => (
              <article
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                key={digest.id}
              >
                <div className="min-w-0">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/app/ai/digests/${encodeURIComponent(digest.id)}`}
                  >
                    {digest.title || "Digest processing"}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dashboardDateFormatter.format(digest.createdAt)} ·{" "}
                    {digest.articleCount} articles
                  </p>
                  {digest.overview && (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {digest.overview}
                    </p>
                  )}
                  {digest.errorMessage && (
                    <p className="mt-2 text-sm text-destructive">
                      {digest.errorMessage}
                    </p>
                  )}
                </div>
                <Badge
                  className="self-start"
                  variant={
                    digest.status === "FAILED" ? "destructive" : "outline"
                  }
                >
                  {digest.status.toLowerCase()}
                </Badge>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No generated digests yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-muted-foreground" />
              <h2 className="font-heading text-base font-medium">
                Recent summaries
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest summaries available in your reader.
            </p>
          </div>
        </div>

        {dashboard.recentSummaries.length ? (
          <div className="divide-y">
            {dashboard.recentSummaries.map((summary) => (
              <article className="p-4" key={summary.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={articleDetailHref(summary.articleId)}
                  >
                    {summary.articleTitle}
                  </Link>
                  <Badge variant="outline">
                    {summary.provider} · {summary.model}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.feedTitle} ·{" "}
                  {dashboardDateFormatter.format(summary.createdAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {summary.shortSummary}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Generate a summary from an article to see it here.
          </p>
        )}
      </section>
    </div>
  )
}
