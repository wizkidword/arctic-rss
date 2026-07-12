"use client"

import { useMemo, useState } from "react"
import {
  BookOpenIcon,
  CheckCircle2Icon,
  HeadphonesIcon,
  type LucideIcon,
  RssIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react"

import { AnalyticsLink } from "@/components/analytics-link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DemoArticle = {
  accent: string
  author: string
  content: string[]
  feed: string
  id: string
  imageClass: string
  meta: string
  summary: string
  title: string
}

const demoArticles: DemoArticle[] = [
  {
    accent: "bg-sky-500",
    author: "Arctic Staff",
    content: [
      "Arctic RSS keeps the useful parts of the open web close by: publishers, podcasts, research blogs, niche communities, and independent writers.",
      "A reader becomes more valuable as it becomes more personal. Start with a few trusted sources, then let Discover help fill the gaps.",
    ],
    feed: "Morning Briefing",
    id: "morning-briefing",
    imageClass: "from-sky-200 via-cyan-100 to-white",
    meta: "Today, 8:15 AM",
    summary: "A calm overview of how a personal reader can replace noisy feeds.",
    title: "A quieter way to follow the open web",
  },
  {
    accent: "bg-emerald-500",
    author: "Climate Desk",
    content: [
      "Independent reporting is easiest to follow when every publisher lands in one place. RSS keeps the relationship direct and portable.",
      "Collections make it simple to hold long reads for later without losing them to a timeline.",
    ],
    feed: "Climate Watch",
    id: "climate-reporting",
    imageClass: "from-emerald-200 via-teal-100 to-slate-50",
    meta: "Today, 7:40 AM",
    summary: "Follow climate sources directly and save the pieces that deserve time.",
    title: "Independent climate reporting",
  },
  {
    accent: "bg-violet-500",
    author: "Research Notes",
    content: [
      "AI news moves quickly, but a focused feed makes it easier to separate durable research from launch noise.",
      "Smart digests can later turn a chosen set of feeds into topic-specific updates.",
    ],
    feed: "AI Research",
    id: "ai-research",
    imageClass: "from-violet-200 via-blue-100 to-white",
    meta: "Yesterday, 6:20 PM",
    summary: "A focused reading list can make fast-moving AI updates easier to digest.",
    title: "Tracking AI without chasing every headline",
  },
  {
    accent: "bg-amber-500",
    author: "Podcast Desk",
    content: [
      "Podcasts sit beside feeds in Arctic RSS, so articles and episodes can share the same collections.",
      "Streaming keeps the experience lightweight while still making the reader feel complete.",
    ],
    feed: "Podcast Queue",
    id: "podcast-queue",
    imageClass: "from-amber-200 via-orange-100 to-white",
    meta: "Yesterday, 3:05 PM",
    summary: "Episodes can live next to articles without turning the reader into a full media library.",
    title: "A simple queue for episodes worth hearing",
  },
]

const topicGroups = [
  { count: "18", label: "AI" },
  { count: "53", label: "Business" },
  { count: "29", label: "Food" },
  { count: "12", label: "Science" },
]

export function DemoReader() {
  const [selectedArticleId, setSelectedArticleId] = useState(demoArticles[0].id)
  const selectedArticle = useMemo(
    () =>
      demoArticles.find((article) => article.id === selectedArticleId) ??
      demoArticles[0],
    [selectedArticleId]
  )

  return (
    <main className="min-h-screen bg-[#eef9ff] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-sky-100 bg-white/85 p-4 lg:border-r lg:border-b-0">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-950 text-white shadow-sm shadow-sky-950/20">
              <RssIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading font-semibold">Arctic RSS</p>
              <p className="text-xs text-slate-500">Demo Reader</p>
            </div>
          </div>

          <nav className="grid gap-1 text-sm" aria-label="Demo sections">
            <DemoNavItem active icon={BookOpenIcon} label="All Articles" count="42" />
            <DemoNavItem icon={CheckCircle2Icon} label="Unread" count="18" />
            <DemoNavItem icon={StarIcon} label="Starred" count="6" />
            <DemoNavItem icon={HeadphonesIcon} label="Podcasts" count="9" />
            <DemoNavItem icon={SparklesIcon} label="Smart Digests" count="3" />
          </nav>

          <div className="mt-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Discover
            </p>
            <div className="grid gap-2">
              {topicGroups.map((topic) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm"
                  key={topic.label}
                >
                  <span>{topic.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {topic.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-sky-100 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">This is a sample Arctic RSS reader.</p>
                <p className="text-sm text-slate-500">
                  Create an account to subscribe to your own feeds and podcasts.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AnalyticsLink
                  analyticsEvent="demo_create_account_click"
                  analyticsParams={{ link_location: "demo_banner" }}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm shadow-sky-950/15 transition hover:bg-slate-800"
                  )}
                  href="/signup"
                >
                  Create your reader
                </AnalyticsLink>
                <AnalyticsLink
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-sky-50"
                  href="/"
                >
                  Back home
                </AnalyticsLink>
              </div>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 sm:p-6 xl:grid-cols-[390px_1fr]">
            <section className="min-w-0 rounded-xl border border-sky-100 bg-white/90 shadow-xl shadow-sky-950/5">
              <div className="border-b border-sky-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h1 className="font-heading text-xl font-semibold">
                      Morning Briefing
                    </h1>
                    <p className="text-sm text-slate-500">Newest items first</p>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs text-slate-500 sm:flex">
                    <SearchIcon className="size-3.5" aria-hidden="true" />
                    <span>Search</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 p-3">
                {demoArticles.map((article) => (
                  <button
                    aria-label={`Open ${article.title}`}
                    className={cn(
                      "group grid w-full grid-cols-[auto_1fr] gap-3 rounded-xl border p-3 text-left transition",
                      selectedArticle.id === article.id
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-100 bg-white hover:border-sky-100 hover:bg-slate-50"
                    )}
                    key={article.id}
                    onClick={() => setSelectedArticleId(article.id)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "mt-1 size-3 rounded-full shadow-sm",
                        article.accent
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {article.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {article.feed} - {article.meta}
                      </span>
                      <span className="mt-2 block line-clamp-2 text-sm leading-6 text-slate-600">
                        {article.summary}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <article className="min-w-0 overflow-hidden rounded-xl border border-sky-100 bg-white shadow-xl shadow-sky-950/5">
              <div className={cn("h-48 bg-gradient-to-br", selectedArticle.imageClass)} />
              <div className="grid gap-5 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sky-700">
                      {selectedArticle.feed}
                    </p>
                    <h2 className="mt-2 max-w-2xl font-heading text-2xl font-semibold leading-tight">
                      {selectedArticle.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedArticle.author} - {selectedArticle.meta}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="icon" variant="outline" aria-label="Star sample article">
                      <StarIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="outline" aria-label="Save sample article">
                      <BookOpenIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <SparklesIcon className="size-4 text-sky-700" aria-hidden="true" />
                    AI Summary
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {selectedArticle.summary}
                  </p>
                </div>

                <div className="grid gap-4 text-base leading-8 text-slate-700">
                  {selectedArticle.content.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}

function DemoNavItem({
  active = false,
  count,
  icon: Icon,
  label,
}: {
  active?: boolean
  count: string
  icon: LucideIcon
  label: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2",
        active ? "bg-sky-50 text-slate-950" : "text-slate-600"
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <span className="text-xs text-slate-500">{count}</span>
    </div>
  )
}
