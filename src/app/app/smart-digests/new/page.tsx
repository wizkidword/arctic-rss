import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeftIcon, SparklesIcon } from "lucide-react"

import { auth } from "@/auth"
import { SmartDigestRuleForm } from "@/components/smart-digest-rule-form"
import { buttonVariants } from "@/components/ui/button"
import { listSmartDigestSourceOptions } from "@/lib/smart-digests"
import { cn } from "@/lib/utils"

export default async function NewSmartDigestPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const sourceOptions = await listSmartDigestSourceOptions(session.user.id)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">
              Create Smart Digest
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build a scheduled briefing from your feeds, folders, or selected sources.
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

      <SmartDigestRuleForm
        folders={sourceOptions.folders}
        subscriptions={sourceOptions.subscriptions}
      />
    </div>
  )
}
