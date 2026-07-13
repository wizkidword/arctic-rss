"use client"

import { useState } from "react"

import { imageProxyUrl } from "@/lib/image-proxy-url"

type IconAttempt = "preferred" | "domain" | "initials"

export function ArticleSourceIcon({
  articleUrl,
  faviconUrl,
  title,
}: {
  articleUrl: string
  faviconUrl: string | null
  title: string
}) {
  const preferredIconUrl = normalizedFaviconUrl(faviconUrl)
  const domainIconUrl = articleDomainIconUrl(articleUrl)
  const [attempt, setAttempt] = useState<IconAttempt>(
    domainIconUrl ? "domain" : preferredIconUrl ? "preferred" : "initials"
  )
  const iconUrl = attempt === "domain" ? domainIconUrl : preferredIconUrl

  if (attempt !== "initials" && iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${title} icon`}
        className="size-8 shrink-0 rounded-md border bg-muted object-contain p-1"
        onError={() => {
          setAttempt((currentAttempt) => {
            if (
              currentAttempt === "domain" &&
              preferredIconUrl &&
              preferredIconUrl !== domainIconUrl
            ) {
              return "preferred"
            }

            return "initials"
          })
        }}
        src={iconUrl}
      />
    )
  }

  return (
    <span
      aria-label={`${title} icon`}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold uppercase text-muted-foreground"
    >
      {sourceInitials(title)}
    </span>
  )
}

function normalizedFaviconUrl(faviconUrl: string | null) {
  return imageProxyUrl(faviconUrl)
}

function articleDomainIconUrl(articleUrl: string) {
  try {
    const domain = new URL(articleUrl).hostname.replace(/^www\./, "")

    if (!domain) {
      return null
    }

    return imageProxyUrl(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
    )
  } catch {
    return null
  }
}

function sourceInitials(title: string) {
  const normalizedTitle = title.trim()

  if (!normalizedTitle) {
    return "?"
  }

  return normalizedTitle
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
}
