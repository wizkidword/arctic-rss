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
            <h1 className="font-heading text-xl font-semibold">
              Smart Digests
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Watch selected feeds for specific topics and receive scheduled briefings.
          </p>
        </div>
        <Link
          className={cn(buttonVariants(), "w-fit gap-2")}
          href="/app/smart-digests/new"
        >
          <PlusIcon data-icon="inline-start" />
          Create digest
        </Link>
      </section>

      <SmartDigestRuleList rules={rules} />
    </div>
  )
}
