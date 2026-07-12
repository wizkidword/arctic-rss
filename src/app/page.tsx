import Link from "next/link"
import Image from "next/image"
import {
  ArrowRightIcon,
  CompassIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"

import { AnalyticsLink } from "@/components/analytics-link"
import { buttonVariants } from "@/components/ui/button"
import { legalLinks } from "@/lib/legal-links"
import { cn } from "@/lib/utils"

const topicCards = [
  {
    count: "18 feeds",
    label: "AI",
    tone:
      "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/45 dark:text-cyan-200 dark:ring-cyan-900/70",
  },
  {
    count: "6 feeds",
    label: "Cybersecurity",
    tone:
      "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/45 dark:text-indigo-200 dark:ring-indigo-900/70",
  },
  {
    count: "29 feeds",
    label: "Food",
    tone:
      "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-900/70",
  },
  {
    count: "53 feeds",
    label: "Business",
    tone:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-900/70",
  },
]

const discoverFeeds = [
  {
    source: "MIT News",
    title: "Artificial Intelligence",
  },
  {
    source: "The Hacker News",
    title: "Security Briefing",
  },
  {
    source: "ScienceDaily",
    title: "Earth & Climate",
  },
]

const systemThemeScript = `
(() => {
  const query = "(prefers-color-scheme: dark)";
  const media = window.matchMedia(query);
  const apply = () => {
    const isDark = media.matches;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.dataset.readerTheme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  };

  apply();
  media.addEventListener("change", apply);
})();
`

export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: systemThemeScript }} />
      <main className="min-h-screen overflow-hidden bg-[#f3fbff] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-4 top-6 h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent dark:via-slate-800" />
        <div className="relative grid min-w-0 flex-1 items-center gap-12 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:py-10">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex flex-col gap-6">
              <h1 className="max-w-sm">
                <Image
                  alt="Arctic RSS"
                  className="h-auto w-full"
                  height={243}
                  priority
                  src="/brand/arctic-rss-wordmark.png"
                  unoptimized
                  width={770}
                />
              </h1>
              <p className="max-w-xl text-2xl leading-9 text-slate-700 dark:text-slate-200">
                Follow the open web without the noise.
              </p>
              <p className="max-w-lg text-base leading-7 text-slate-500 dark:text-slate-400">
                Build a calm reading space from the publishers, creators, and
                communities you choose.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AnalyticsLink
                analyticsEvent="create_account_click"
                analyticsParams={{ link_location: "landing_hero" }}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 bg-slate-950 text-white shadow-lg shadow-sky-950/10 hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-sky-100",
                )}
                href="/signup"
              >
                Create account
                <ArrowRightIcon data-icon="inline-end" />
              </AnalyticsLink>
              <AnalyticsLink
                analyticsEvent="guest_browse_start"
                analyticsParams={{ link_location: "landing_hero" }}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "border border-sky-100 bg-white/80 text-slate-800 shadow-sm shadow-sky-950/5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800",
                )}
                href="/guest"
              >
                Browse as Guest
              </AnalyticsLink>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-sky-200 bg-white/70 text-slate-700 shadow-sm shadow-sky-950/5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
                href="/login"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 lg:max-w-[520px] lg:justify-self-end">
            <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white/90 shadow-2xl shadow-sky-950/10 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-black/30">
              <div className="flex items-center justify-between border-b border-sky-100 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/75">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/45 dark:text-sky-200 dark:ring-sky-900/70">
                    <CompassIcon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Discover</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Topics and feeds</p>
                  </div>
                </div>
                <div className="hidden max-w-36 items-center gap-2 rounded-full border border-sky-100 bg-sky-50/70 px-3 py-1.5 text-xs text-slate-500 sm:flex dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                  <SearchIcon className="size-3.5" aria-hidden="true" />
                  <span className="truncate">Search topics</span>
                </div>
              </div>
              <div className="grid min-w-0 gap-0 md:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-sky-100 bg-slate-50/55 p-4 dark:border-slate-800 dark:bg-slate-950/55 md:border-r md:border-b-0">
                  <div className="grid grid-cols-2 gap-3">
                    {topicCards.map((topic) => (
                      <div
                        className="min-w-0 rounded-xl border border-white bg-white/85 p-3 shadow-sm shadow-sky-950/5 ring-1 ring-sky-100/70 dark:border-slate-800 dark:bg-slate-900/85 dark:ring-slate-800"
                        key={topic.label}
                      >
                        <div
                          className={cn(
                            "mb-4 flex size-8 items-center justify-center rounded-lg ring-1",
                            topic.tone,
                          )}
                        >
                          <SparklesIcon className="size-4" aria-hidden="true" />
                        </div>
                        <p className="truncate text-xs font-semibold leading-5 text-slate-950 dark:text-slate-50">
                          {topic.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{topic.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3 p-4">
                  {discoverFeeds.map((feed) => (
                    <div
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white p-3 shadow-sm shadow-sky-950/5 dark:border-slate-800 dark:bg-slate-950/70"
                      key={feed.title}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-semibold text-white dark:bg-slate-50 dark:text-slate-950">
                          {feed.source.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                            {feed.title}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {feed.source}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-950/10">
                        <PlusIcon className="size-3.5" aria-hidden="true" />
                        Follow
                      </span>
                    </div>
                  ))}
                  <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/65 px-4 py-3 text-sm font-medium text-sky-900 dark:border-sky-900/80 dark:bg-sky-950/30 dark:text-sky-100">
                    Browse by topic, then add the feeds worth keeping.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer className="relative flex flex-col gap-3 border-t border-sky-100 py-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Arctic RSS keeps the open web readable.</p>
          <nav aria-label="Legal links" className="flex flex-wrap gap-x-4 gap-y-2">
            {legalLinks.map((item) => (
              <Link
                className="transition hover:text-slate-950 dark:hover:text-slate-50"
                href={item.href}
                key={item.href}
              >
                {item.shortLabel}
              </Link>
            ))}
          </nav>
        </footer>
        </section>
      </main>
    </>
  )
}
