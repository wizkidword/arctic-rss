import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-tight sm:text-5xl">
                Arctic RSS
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                A clean, open-source RSS reader foundation inspired by Google Reader, built for private feeds, folders, saved views, and future AI summaries.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className={cn(buttonVariants({ size: "lg" }), "gap-2")} href="/signup">
                Create account
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <Link
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                href="/login"
              >
                Log in
              </Link>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-0 p-0">
              <div className="grid grid-cols-[120px_1fr] border-b bg-muted/40 text-xs text-muted-foreground">
                <div className="border-r p-3">Feeds</div>
                <div className="p-3">Article Stream</div>
              </div>
              <div className="grid min-h-80 grid-cols-[120px_1fr]">
                <div className="flex flex-col gap-2 border-r p-3 text-xs">
                  <span className="rounded bg-background px-2 py-1">All Articles</span>
                  <span className="px-2 py-1 text-muted-foreground">Unread</span>
                  <span className="px-2 py-1 text-muted-foreground">Starred</span>
                </div>
                <div className="flex flex-col gap-3 p-4">
                  {["Classic three-pane shell", "Card view preference", "Worker-ready backend"].map((title) => (
                    <div key={title} className="rounded-lg border bg-background p-3">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Foundation milestone
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
