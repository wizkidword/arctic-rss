import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { legalLastUpdated, legalLinks } from "@/lib/legal-links"
import { cn } from "@/lib/utils"

type LegalPageLayoutProps = {
  children: ReactNode
  description: string
  title: string
}

export function LegalPageLayout({
  children,
  description,
  title,
}: LegalPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#f3fbff] text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-2">
          <Link
            aria-label="Arctic RSS home"
            className="inline-flex rounded-lg bg-white/80 px-2 py-1 shadow-sm shadow-sky-950/5 ring-1 ring-sky-100/80 transition hover:bg-white"
            href="/"
          >
            <Image
              alt="Arctic RSS"
              className="h-9 w-auto sm:h-10"
              height={243}
              priority
              src="/brand/arctic-rss-wordmark.png"
              unoptimized
              width={770}
            />
          </Link>
          <Link
            className="rounded-lg border border-sky-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm shadow-sky-950/5 transition hover:bg-white"
            href="/app"
          >
            Reader
          </Link>
        </header>
        <div className="flex flex-1 flex-col gap-10 py-12">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">
              Arctic RSS
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              {description}
            </p>
            <p className="text-sm text-slate-500">
              Last updated: {legalLastUpdated}
            </p>
          </div>
          <nav
            aria-label="Legal pages"
            className="flex flex-wrap gap-2 border-y border-sky-100 py-3"
          >
            {legalLinks.map((item) => (
              <Link
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white hover:text-slate-950",
                  item.label === title && "bg-white text-slate-950 shadow-sm"
                )}
                href={item.href}
                key={item.href}
              >
                {item.shortLabel}
              </Link>
            ))}
          </nav>
          <article className="max-w-none rounded-xl border border-sky-100 bg-white/82 p-5 shadow-xl shadow-sky-950/5 sm:p-8">
            {children}
          </article>
        </div>
        <footer className="flex flex-col gap-2 border-t border-sky-100 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Questions? Email support@arcticrss.com.</p>
          <Link className="hover:text-slate-950" href="/">
            Back to arcticrss.com
          </Link>
        </footer>
      </section>
    </main>
  )
}

export function PolicySection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="not-prose flex flex-col gap-3 border-b border-sky-100 py-6 last:border-b-0 last:pb-0 first:pt-0">
      <h2 className="font-heading text-xl font-semibold tracking-normal text-slate-950">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-7 text-slate-600">
        {children}
      </div>
    </section>
  )
}
