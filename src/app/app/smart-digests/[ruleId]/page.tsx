import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon, CalendarClockIcon, MailIcon } from "lucide-react"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getSmartDigestRuleForUser } from "@/lib/smart-digests"
import { cn } from "@/lib/utils"

const ruleDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default async function SmartDigestRulePage({
  params,
}: {
  params: Promise<{
    ruleId: string
  }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { ruleId } = await params
  const rule = await getSmartDigestRuleForUser({
    ruleId,
    userId: session.user.id,
  })

  if (!rule) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">{rule.name}</h1>
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
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {rule.topicPrompt}
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          href="/app/smart-digests"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Smart Digests
        </Link>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">Schedule</h2>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Next run</dt>
            <dd className="mt-1 text-sm font-medium">
              {rule.nextRunAt ? ruleDateFormatter.format(rule.nextRunAt) : "Not scheduled"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Hour</dt>
            <dd className="mt-1 text-sm font-medium">
              {rule.scheduledHour}:00 {rule.timeZone}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Scope</dt>
            <dd className="mt-1 text-sm font-medium">
              {rule.sourceScope.toLowerCase().replaceAll("_", " ")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-heading text-base font-medium">Terms</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {rule.includeTerms.map((term) => (
            <Badge key={term} variant="secondary">
              {term}
            </Badge>
          ))}
          {rule.excludeTerms.map((term) => (
            <Badge key={term} variant="outline">
              exclude {term}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  )
}
