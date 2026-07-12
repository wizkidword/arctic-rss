import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"

import { normalizeHttpUrl } from "./url-safety"

export type ExtractedArticleContent = {
  contentHtml: string
  contentText: string
  imageUrl?: string
  summary?: string
}

const MIN_READABLE_TEXT_LENGTH = 80
const READABLE_SELECTOR = [
  "article",
  "main",
  "[role='main']",
  ".entry-content",
  ".article-content",
  ".post-content",
  ".story-body",
  ".content",
].join(", ")

export function extractReadableArticleContent(
  html: string,
  pageUrl: string
): ExtractedArticleContent | null {
  const $ = cheerio.load(html)

  $(
    [
      "script",
      "style",
      "noscript",
      "svg",
      "iframe",
      "form",
      "button",
      "input",
      "select",
      "textarea",
      "nav",
      "header",
      "footer",
      "aside",
    ].join(", ")
  ).remove()

  const candidates = $(READABLE_SELECTOR).toArray()
  const candidate = bestReadableCandidate($, candidates.length ? candidates : [$("body")[0]])

  if (!candidate) {
    return null
  }

  const selected = $(candidate).clone()
  normalizeEmbeddedUrls($, selected, pageUrl)

  const readableNodes = selected
    .find("h1, h2, h3, h4, p, ul, ol, blockquote, pre")
    .toArray()
    .filter((node) => plainText($(node).text()).length > 0)
    .slice(0, 80)

  const contentHtml = readableNodes.length
    ? readableNodes.map((node) => $.html(node)).join("\n").trim()
    : `<p>${escapeHtml(plainText(selected.text()))}</p>`
  const contentText = plainText(contentHtml)

  if (contentText.length < MIN_READABLE_TEXT_LENGTH) {
    return null
  }

  return {
    contentHtml,
    contentText,
    imageUrl: pageImageUrl($, selected, pageUrl),
    summary: pageSummary($),
  }
}

function bestReadableCandidate(
  $: cheerio.CheerioAPI,
  candidates: Array<AnyNode | undefined>
) {
  return candidates
    .filter((candidate) => candidate !== undefined)
    .map((candidate) => ({
      candidate,
      score: readableScore($, candidate),
    }))
    .sort((a, b) => b.score - a.score)[0]?.candidate
}

function readableScore(
  $: cheerio.CheerioAPI,
  candidate: AnyNode
) {
  const node = $(candidate)
  const textLength = plainText(node.text()).length
  const paragraphCount = node.find("p").length
  const headingCount = node.find("h1, h2, h3").length

  return textLength + paragraphCount * 100 + headingCount * 30
}

function normalizeEmbeddedUrls(
  $: cheerio.CheerioAPI,
  selected: cheerio.Cheerio<AnyNode>,
  pageUrl: string
) {
  selected.find("a[href]").each((_, element) => {
    const href = $(element).attr("href")
    const normalizedHref = normalizeOptionalUrl(href, pageUrl)

    if (normalizedHref) {
      $(element).attr("href", normalizedHref)
    }
  })

  selected.find("img[src]").each((_, element) => {
    const src = $(element).attr("src")
    const normalizedSrc = normalizeOptionalUrl(src, pageUrl)

    if (normalizedSrc) {
      $(element).attr("src", normalizedSrc)
    }
  })
}

function pageSummary($: cheerio.CheerioAPI) {
  return (
    plainText($("meta[name='description']").attr("content")) ||
    plainText($("meta[property='og:description']").attr("content")) ||
    plainText($("meta[name='twitter:description']").attr("content")) ||
    undefined
  )
}

function pageImageUrl(
  $: cheerio.CheerioAPI,
  selected: cheerio.Cheerio<AnyNode>,
  pageUrl: string
) {
  return (
    normalizeOptionalUrl($("meta[property='og:image']").attr("content"), pageUrl) ||
    normalizeOptionalUrl($("meta[name='twitter:image']").attr("content"), pageUrl) ||
    normalizeOptionalUrl(selected.find("img[src]").first().attr("src"), pageUrl)
  )
}

function normalizeOptionalUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return undefined
  }

  try {
    return normalizeHttpUrl(new URL(value, baseUrl).href).href
  } catch {
    return undefined
  }
}

function plainText(value: string | undefined) {
  return cheerio.load(value ?? "").text().replace(/\s+/g, " ").trim()
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
