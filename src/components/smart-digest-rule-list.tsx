import Link from "next/link"
import { CalendarClockIcon, MailIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { SmartDigestRuleListItem } from "@/lib/smart-digests"

const ruleDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function SmartDigestRuleList({
  rules,
}: {
  rules: SmartDigestRuleListItem[]
}) {
  if (!rules.length) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">
            No Smart Digests yet
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a topic watchlist from the feeds you already follow.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">Rules</h2>
        </div>
        <Badge variant="secondary">{rules.length}</Badge>
      </div>
      <div className="divide-y">
        {rules.map((rule) => {
          const latestDigest = rule.digests[0]

          return (
            <article
              className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              key={rule.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/app/smart-digests/${encodeURIComponent(rule.id)}`}
                  >
                    {rule.name}
                  </Link>
                  <Badge variant={rule.isEnabled ? "secondary" : "outline"}>
                    {rule.isEnabled ? "enabled" : "paused"}
                  </Badge>
                  {rule.emailEnabled && (
                    <Badge variant="outline">
                      <MailIcon data-icon="inline-start" />
                      email
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rule.topicPrompt}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClockIcon className="size-3" />
                  <span>
                    {rule.nextRunAt
                      ? `Next ${ruleDateFormatter.format(rule.nextRunAt)}`
                      : "Not scheduled"}
                  </span>
                  <span>{rule.sourceScope.toLowerCase().replaceAll("_", " ")}</span>
                </p>
              </div>
              {latestDigest ? (
                <Link
                  className="self-start text-sm font-medium underline-offset-4 hover:underline"
                  href={`/app/smart-digests/digests/${encodeURIComponent(
                    latestDigest.id
                  )}`}
                >
                  Latest digest
                </Link>
              ) : (
                <Badge className="self-start" variant="outline">
                  waiting
                </Badge>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
