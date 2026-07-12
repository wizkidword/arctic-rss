import sanitizeHtml from "sanitize-html"

import { estimateAiUsageCost } from "./ai-costs"
import { getPrisma } from "./db"

const DEFAULT_LOCAL_MODEL = "local-extractive-v1"
const DEFAULT_OPENAI_MODEL = "gpt-5.5"
const MAX_ARTICLE_CHARS = 12_000

export type AiSummaryProviderInput = {
  content: string
  title: string
  url: string
}

export type AiSummaryProviderResult = {
  bulletSummary: string[]
  category?: string | null
  inputTokens?: number
  keyTakeaway?: string | null
  outputTokens?: number
  readingTimeSeconds?: number | null
  sentiment?: string | null
  shortSummary: string
}

export type AiSummaryProvider = {
  model: string
  name: string
  summarize(input: AiSummaryProviderInput): Promise<AiSummaryProviderResult>
}

type ArticleForSummary = {
  contentHtml: string | null
  contentText: string | null
  id: string
  summary: string | null
  title: string
  url: string
}

type UserAiUsage = {
  aiMonthlyLimit: number
  aiMonthlyUsed: number
}

type StoredArticleSummary = {
  bulletSummary: unknown
  category: string | null
  id: string
  keyTakeaway: string | null
  model: string
  provider: string
  readingTimeSeconds: number | null
  sentiment: string | null
  shortSummary: string
  tokenCount: number | null
}

export type ArticleSummaryResult = {
  bulletSummary: string[]
  category: string | null
  fromCache: boolean
  id?: string
  keyTakeaway: string | null
  model: string
  provider: string
  readingTimeSeconds: number | null
  sentiment: string | null
  shortSummary: string
  tokenCount: number | null
}

export type AiSummaryStore = {
  aiUsageLog: {
    create(args: {
      data: {
        action: "ARTICLE_SUMMARY"
        costEstimate: number | null
        inputTokens: number
        model: string
        outputTokens: number
        provider: string
        userId: string
      }
    }): Promise<unknown>
  }
  article: {
    findFirst(args: {
      select: {
        contentHtml: true
        contentText: true
        id: true
        summary: true
        title: true
        url: true
      }
      where: Record<string, unknown>
    }): Promise<ArticleForSummary | null>
  }
  articleAiSummary: {
    findUnique(args: {
      where: {
        articleId_provider_model: {
          articleId: string
          model: string
          provider: string
        }
      }
    }): Promise<StoredArticleSummary | null>
    upsert(args: {
      create: {
        articleId: string
        bulletSummary: string[]
        category: string | null
        keyTakeaway: string | null
        model: string
        provider: string
        readingTimeSeconds: number | null
        sentiment: string | null
        shortSummary: string
        tokenCount: number
      }
      update: {
        bulletSummary: string[]
        category: string | null
        keyTakeaway: string | null
        readingTimeSeconds: number | null
        sentiment: string | null
        shortSummary: string
        tokenCount: number
      }
      where: {
        articleId_provider_model: {
          articleId: string
          model: string
          provider: string
        }
      }
    }): Promise<{ id?: string }>
  }
  user: {
    findUnique(args: {
      select: {
        aiMonthlyLimit: true
        aiMonthlyUsed: true
      }
      where: {
        id: string
      }
    }): Promise<UserAiUsage | null>
    update(args: {
      data: {
        aiMonthlyUsed: {
          increment: 1
        }
      }
      where: {
        id: string
      }
    }): Promise<unknown>
  }
}

export class AiSummaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiSummaryError"
  }
}

export async function generateArticleSummaryForUser({
  articleId,
  provider = getAiSummaryProvider(),
  userId,
}: {
  articleId: string
  provider?: AiSummaryProvider
  userId: string
}) {
  return generateArticleSummaryWithClient({
    articleId,
    provider,
    store: getAiSummaryStore(),
    userId,
  })
}

export async function generateArticleSummaryWithClient({
  articleId,
  provider,
  store,
  userId,
}: {
  articleId: string
  provider: AiSummaryProvider
  store: AiSummaryStore
  userId: string
}): Promise<ArticleSummaryResult> {
  const article = await store.article.findFirst({
    select: {
      contentHtml: true,
      contentText: true,
      id: true,
      summary: true,
      title: true,
      url: true,
    },
    where: {
      feed: {
        subscriptions: {
          some: {
            isPaused: false,
            userId,
          },
        },
      },
      id: articleId,
    },
  })

  if (!article) {
    throw new AiSummaryError("Article not found.")
  }

  const summaryKey = {
    articleId_provider_model: {
      articleId,
      model: provider.model,
      provider: provider.name,
    },
  }
  const cachedSummary = await store.articleAiSummary.findUnique({
    where: summaryKey,
  })

  if (cachedSummary) {
    return mapStoredSummary(cachedSummary, true)
  }

  const user = await store.user.findUnique({
    select: {
      aiMonthlyLimit: true,
      aiMonthlyUsed: true,
    },
    where: {
      id: userId,
    },
  })

  if (!user) {
    throw new AiSummaryError("User not found.")
  }

  if (user.aiMonthlyUsed >= user.aiMonthlyLimit) {
    throw new AiSummaryError("AI summary monthly limit reached.")
  }

  const generated = normalizeProviderResult(
    await provider.summarize({
      content: formatArticleForSummary(article),
      title: article.title,
      url: article.url,
    })
  )
  const tokenCount = generated.inputTokens + generated.outputTokens

  const storedSummary = await store.articleAiSummary.upsert({
    create: {
      articleId,
      bulletSummary: generated.bulletSummary,
      category: generated.category,
      keyTakeaway: generated.keyTakeaway,
      model: provider.model,
      provider: provider.name,
      readingTimeSeconds: generated.readingTimeSeconds,
      sentiment: generated.sentiment,
      shortSummary: generated.shortSummary,
      tokenCount,
    },
    update: {
      bulletSummary: generated.bulletSummary,
      category: generated.category,
      keyTakeaway: generated.keyTakeaway,
      readingTimeSeconds: generated.readingTimeSeconds,
      sentiment: generated.sentiment,
      shortSummary: generated.shortSummary,
      tokenCount,
    },
    where: summaryKey,
  })

  await store.aiUsageLog.create({
    data: {
      action: "ARTICLE_SUMMARY",
      costEstimate: estimateAiUsageCost({
        inputTokens: generated.inputTokens,
        model: provider.model,
        outputTokens: generated.outputTokens,
        provider: provider.name,
      }),
      inputTokens: generated.inputTokens,
      model: provider.model,
      outputTokens: generated.outputTokens,
      provider: provider.name,
      userId,
    },
  })
  await store.user.update({
    data: {
      aiMonthlyUsed: {
        increment: 1,
      },
    },
    where: {
      id: userId,
    },
  })

  return {
    bulletSummary: generated.bulletSummary,
    category: generated.category,
    fromCache: false,
    id: storedSummary.id,
    keyTakeaway: generated.keyTakeaway,
    model: provider.model,
    provider: provider.name,
    readingTimeSeconds: generated.readingTimeSeconds,
    sentiment: generated.sentiment,
    shortSummary: generated.shortSummary,
    tokenCount,
  }
}

export function getAiSummaryProvider(): AiSummaryProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase()

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new AiSummaryError("OPENAI_API_KEY is required for OpenAI summaries.")
    }

    return createOpenAiSummaryProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model:
        process.env.OPENAI_SUMMARY_MODEL ||
        process.env.AI_DEFAULT_MODEL ||
        DEFAULT_OPENAI_MODEL,
    })
  }

  return createLocalSummaryProvider()
}

export function createLocalSummaryProvider(): AiSummaryProvider {
  return {
    model: DEFAULT_LOCAL_MODEL,
    name: "local",
    async summarize({ content, title }) {
      const source = localArticleText(content)
      const sentences = splitSentences(source)
      const shortSummary =
        truncateText(sentences.slice(0, 2).join(" "), 320) ||
        truncateText(title, 320)
      const bulletSummary = sentences
        .slice(0, 3)
        .map((sentence) => truncateText(sentence, 180))
        .filter(Boolean)

      return {
        bulletSummary:
          bulletSummary.length > 0 ? bulletSummary : [truncateText(title, 180)],
        category: "General",
        inputTokens: estimateTokenCount(content),
        keyTakeaway: bulletSummary[0] || shortSummary,
        outputTokens: estimateTokenCount(shortSummary + bulletSummary.join(" ")),
        readingTimeSeconds: estimateReadingTimeSeconds(source),
        sentiment: "neutral",
        shortSummary,
      }
    },
  }
}

function localArticleText(content: string) {
  return compactWhitespace(
    content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(Title|URL):\s*/i.test(line))
      .map((line) => line.replace(/^(Summary|Body):\s*/i, ""))
      .join(" ")
  )
}

function createOpenAiSummaryProvider({
  apiKey,
  model,
}: {
  apiKey: string
  model: string
}): AiSummaryProvider {
  return {
    model,
    name: "openai",
    async summarize({ content, title, url }) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        body: JSON.stringify({
          input: [
            {
              content:
                "Summarize RSS articles for a fast, Google Reader-style reading workflow. Return concise, neutral, publication-safe JSON only.",
              role: "system",
            },
            {
              content: [
                `Article title: ${title}`,
                `Article URL: ${url}`,
                "Article content:",
                content,
              ].join("\n\n"),
              role: "user",
            },
          ],
          model,
          text: {
            format: {
              name: "article_summary",
              schema: {
                additionalProperties: false,
                properties: {
                  bulletSummary: {
                    items: {
                      type: "string",
                    },
                    type: "array",
                  },
                  category: {
                    type: "string",
                  },
                  keyTakeaway: {
                    type: "string",
                  },
                  readingTimeSeconds: {
                    type: "integer",
                  },
                  sentiment: {
                    enum: ["positive", "neutral", "negative", "mixed"],
                    type: "string",
                  },
                  shortSummary: {
                    type: "string",
                  },
                },
                required: [
                  "shortSummary",
                  "bulletSummary",
                  "keyTakeaway",
                  "category",
                  "sentiment",
                  "readingTimeSeconds",
                ],
                type: "object",
              },
              strict: true,
              type: "json_schema",
            },
          },
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      const payload = (await response.json()) as OpenAiResponsePayload

      if (!response.ok) {
        throw new AiSummaryError(
          payload.error?.message || `OpenAI summary request failed (${response.status}).`
        )
      }

      const parsed = parseOpenAiSummary(payload)

      return {
        ...parsed,
        inputTokens: payload.usage?.input_tokens ?? estimateTokenCount(content),
        outputTokens:
          payload.usage?.output_tokens ??
          estimateTokenCount(parsed.shortSummary + parsed.bulletSummary.join(" ")),
      }
    },
  }
}

function formatArticleForSummary(article: ArticleForSummary) {
  const body = compactWhitespace(
    article.contentText || htmlToPlainText(article.contentHtml) || ""
  )
  const segments = [`Title: ${compactWhitespace(article.title)}`]

  if (article.summary) {
    segments.push(`Summary: ${compactWhitespace(article.summary)}`)
  }

  if (body) {
    segments.push(`Body: ${truncateText(body, MAX_ARTICLE_CHARS)}`)
  }

  segments.push(`URL: ${article.url}`)

  return segments.join("\n\n")
}

function htmlToPlainText(html: string | null) {
  if (!html) {
    return ""
  }

  return sanitizeHtml(html, {
    allowedAttributes: {},
    allowedTags: [],
  })
}

function mapStoredSummary(
  summary: StoredArticleSummary,
  fromCache: boolean
): ArticleSummaryResult {
  return {
    bulletSummary: normalizeBulletSummary(summary.bulletSummary),
    category: summary.category,
    fromCache,
    id: summary.id,
    keyTakeaway: summary.keyTakeaway,
    model: summary.model,
    provider: summary.provider,
    readingTimeSeconds: summary.readingTimeSeconds,
    sentiment: summary.sentiment,
    shortSummary: summary.shortSummary,
    tokenCount: summary.tokenCount,
  }
}

function normalizeProviderResult(result: AiSummaryProviderResult) {
  const shortSummary = truncateText(compactWhitespace(result.shortSummary), 520)

  if (!shortSummary) {
    throw new AiSummaryError("AI provider returned an empty summary.")
  }

  return {
    bulletSummary: normalizeBulletSummary(result.bulletSummary).slice(0, 5),
    category: nullableCompactString(result.category),
    inputTokens: Math.max(0, Math.round(result.inputTokens ?? 0)),
    keyTakeaway: nullableCompactString(result.keyTakeaway),
    outputTokens: Math.max(0, Math.round(result.outputTokens ?? 0)),
    readingTimeSeconds:
      typeof result.readingTimeSeconds === "number"
        ? Math.max(0, Math.round(result.readingTimeSeconds))
        : null,
    sentiment: nullableCompactString(result.sentiment),
    shortSummary,
  }
}

function normalizeBulletSummary(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((bullet): bullet is string => typeof bullet === "string")
    .map((bullet) => truncateText(compactWhitespace(bullet), 220))
    .filter(Boolean)
}

function nullableCompactString(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return compactWhitespace(value) || null
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function truncateText(value: string, maxLength: number) {
  const compact = compactWhitespace(value)

  if (compact.length <= maxLength) {
    return compact
  }

  return `${compact.slice(0, maxLength - 1).trim()}...`
}

function splitSentences(value: string) {
  return compactWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function estimateTokenCount(value: string) {
  return Math.ceil(compactWhitespace(value).split(/\s+/).filter(Boolean).length * 1.35)
}

function estimateReadingTimeSeconds(value: string) {
  const words = compactWhitespace(value).split(/\s+/).filter(Boolean).length

  return Math.max(10, Math.round((words / 220) * 60))
}

type OpenAiResponsePayload = {
  error?: {
    message?: string
  }
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
  }>
  output_parsed?: unknown
  output_text?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

function parseOpenAiSummary(payload: OpenAiResponsePayload) {
  if (isSummaryLike(payload.output_parsed)) {
    return payload.output_parsed
  }

  const outputText =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text

  if (!outputText) {
    throw new AiSummaryError("OpenAI returned no summary text.")
  }

  const parsed = JSON.parse(outputText) as unknown

  if (!isSummaryLike(parsed)) {
    throw new AiSummaryError("OpenAI returned an invalid summary payload.")
  }

  return parsed
}

function isSummaryLike(value: unknown): value is AiSummaryProviderResult {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<AiSummaryProviderResult>

  return (
    typeof candidate.shortSummary === "string" &&
    Array.isArray(candidate.bulletSummary)
  )
}

function getAiSummaryStore() {
  return getPrisma() as unknown as AiSummaryStore
}
