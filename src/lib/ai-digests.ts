import { estimateAiUsageCost } from "./ai-costs"
import { getPrisma } from "./db"

const DEFAULT_LOCAL_DIGEST_MODEL = "local-digest-v1"
const DEFAULT_OPENAI_DIGEST_MODEL = "gpt-5.5"
const MAX_DIGEST_ARTICLES = 20

export type AiDigestSection = "MUST_READ" | "SKIM_LATER"
export type AiDigestStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export type AiDigestProviderArticle = {
  aiSummary: string | null
  articleId: string
  category: string | null
  feedTitle: string
  folderName: string | null
  publishedAt: Date | null
  summary: string
  title: string
  url: string
}

export type AiDigestProviderResult = {
  inputTokens: number
  items: Array<{
    articleId: string
    reason: string | null
    section: AiDigestSection
    summary: string
    topic: string
  }>
  outputTokens: number
  overview: string
  title: string
}

export type AiDigestProvider = {
  generate(input: {
    articles: AiDigestProviderArticle[]
    generatedAt: Date
  }): Promise<AiDigestProviderResult>
  model: string
  name: string
}

type AiDigestRecord = {
  articleCount?: number
  completedAt?: Date | null
  createdAt?: Date
  errorMessage?: string | null
  id: string
  inputTokens?: number
  items?: AiDigestItemRecord[]
  model?: string | null
  outputTokens?: number
  overview?: string | null
  provider?: string | null
  startedAt?: Date | null
  status: AiDigestStatus
  title?: string | null
  user?: {
    aiMonthlyLimit: number
    aiMonthlyUsed: number
    id: string
  }
  userId?: string
}

type AiDigestItemRecord = {
  articleId: string | null
  articleTitle: string
  articleUrl: string
  feedTitle: string
  id: string
  position: number
  publishedAt: Date | null
  reason: string | null
  section: AiDigestSection
  summary: string
  topic: string
}

type DigestArticleRecord = {
  aiSummaries: Array<{
    category: string | null
    shortSummary: string
  }>
  contentText: string | null
  feed: {
    subscriptions: Array<{
      folder: {
        name: string
      } | null
    }>
    title: string
  }
  id: string
  publishedAt: Date | null
  summary: string | null
  title: string
  url: string
}

type AiUsageUser = {
  aiMonthlyLimit: number
  aiMonthlyUsed: number
}

export type AiDigestStore = {
  $transaction<T>(
    callback: (transaction: AiDigestStore) => Promise<T>
  ): Promise<T>
  aiDigest: {
    create(args: Record<string, unknown>): Promise<AiDigestRecord>
    findFirst(args: Record<string, unknown>): Promise<AiDigestRecord | null>
    findUnique(args: Record<string, unknown>): Promise<AiDigestRecord | null>
    update(args: Record<string, unknown>): Promise<unknown>
  }
  aiDigestItem: {
    createMany(args: Record<string, unknown>): Promise<unknown>
    deleteMany(args: Record<string, unknown>): Promise<unknown>
  }
  aiUsageLog: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
  article: {
    count(args: Record<string, unknown>): Promise<number>
    findMany(args: Record<string, unknown>): Promise<DigestArticleRecord[]>
  }
  user: {
    findUnique(args: Record<string, unknown>): Promise<AiUsageUser | null>
    update(args: Record<string, unknown>): Promise<unknown>
  }
}

export class AiDigestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiDigestError"
  }
}

export async function requestAiDigestForUser({
  userId,
}: {
  userId: string
}) {
  return requestAiDigestWithClient({
    store: getAiDigestStore(),
    userId,
  })
}

export async function requestAiDigestWithClient({
  store,
  userId,
}: {
  store: AiDigestStore
  userId: string
}) {
  const activeDigest = await store.aiDigest.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
    },
    where: {
      status: {
        in: ["PENDING", "PROCESSING"],
      },
      userId,
    },
  })

  if (activeDigest) {
    return {
      digestId: activeDigest.id,
      existing: true,
      status: activeDigest.status,
    }
  }

  const [user, eligibleArticleCount] = await Promise.all([
    store.user.findUnique({
      select: {
        aiMonthlyLimit: true,
        aiMonthlyUsed: true,
      },
      where: {
        id: userId,
      },
    }),
    store.article.count({
      where: eligibleAiDigestArticleWhere(userId),
    }),
  ])

  if (!user) {
    throw new AiDigestError("User not found.")
  }

  if (user.aiMonthlyUsed >= user.aiMonthlyLimit) {
    throw new AiDigestError("AI monthly limit reached.")
  }

  if (eligibleArticleCount === 0) {
    throw new AiDigestError("No unread articles are available for a digest.")
  }

  const digest = await store.aiDigest.create({
    data: {
      status: "PENDING",
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  })

  return {
    digestId: digest.id,
    existing: false,
    status: digest.status,
  }
}

export async function processAiDigest({
  digestId,
}: {
  digestId: string
}) {
  return processAiDigestWithClient({
    digestId,
    provider: getAiDigestProvider(),
    store: getAiDigestStore(),
  })
}

export async function processAiDigestWithClient({
  digestId,
  now = () => new Date(),
  provider,
  store,
}: {
  digestId: string
  now?: () => Date
  provider: AiDigestProvider
  store: AiDigestStore
}) {
  const digest = await store.aiDigest.findUnique({
    include: {
      user: {
        select: {
          aiMonthlyLimit: true,
          aiMonthlyUsed: true,
          id: true,
        },
      },
    },
    where: {
      id: digestId,
    },
  })

  if (!digest?.user) {
    throw new AiDigestError("Digest not found.")
  }

  const digestUser = digest.user

  if (digest.status === "COMPLETED") {
    return {
      articleCount: digest.articleCount ?? 0,
      digestId,
      status: "COMPLETED" as const,
    }
  }

  const generatedAt = now()

  try {
    if (digestUser.aiMonthlyUsed >= digestUser.aiMonthlyLimit) {
      throw new AiDigestError("AI monthly limit reached.")
    }

    await store.aiDigest.update({
      data: {
        errorMessage: null,
        startedAt: generatedAt,
        status: "PROCESSING",
      },
      where: {
        id: digestId,
      },
    })

    const articles = await store.article.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        aiSummaries: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            category: true,
            shortSummary: true,
          },
          take: 1,
        },
        contentText: true,
        feed: {
          select: {
            subscriptions: {
              select: {
                folder: {
                  select: {
                    name: true,
                  },
                },
              },
              take: 1,
              where: {
                isPaused: false,
                userId: digestUser.id,
              },
            },
            title: true,
          },
        },
        id: true,
        publishedAt: true,
        summary: true,
        title: true,
        url: true,
      },
      take: MAX_DIGEST_ARTICLES,
      where: eligibleAiDigestArticleWhere(digestUser.id),
    })

    if (!articles.length) {
      throw new AiDigestError("No unread articles are available for a digest.")
    }

    const providerArticles = articles.map(mapProviderArticle)
    const generated = normalizeDigestResult(
      await provider.generate({
        articles: providerArticles,
        generatedAt,
      }),
      providerArticles
    )
    const articlesById = new Map(
      providerArticles.map((article) => [article.articleId, article])
    )
    const sectionPositions = {
      MUST_READ: 0,
      SKIM_LATER: 0,
    }
    const itemData = generated.items.map((item) => {
      const article = articlesById.get(item.articleId)

      if (!article) {
        throw new AiDigestError("Digest provider returned an unknown article.")
      }

      const position = sectionPositions[item.section]++

      return {
        articleId: article.articleId,
        articleTitle: article.title,
        articleUrl: article.url,
        digestId,
        feedTitle: article.feedTitle,
        position,
        publishedAt: article.publishedAt,
        reason: item.reason,
        section: item.section,
        summary: item.summary,
        topic: item.topic,
      }
    })

    await store.$transaction(async (transaction) => {
      await transaction.aiDigestItem.deleteMany({
        where: {
          digestId,
        },
      })
      await transaction.aiDigestItem.createMany({
        data: itemData,
      })
      await transaction.aiDigest.update({
        data: {
          articleCount: itemData.length,
          completedAt: generatedAt,
          errorMessage: null,
          inputTokens: generated.inputTokens,
          model: provider.model,
          outputTokens: generated.outputTokens,
          overview: generated.overview,
          provider: provider.name,
          status: "COMPLETED",
          title: generated.title,
        },
        where: {
          id: digestId,
        },
      })
      await transaction.aiUsageLog.create({
        data: {
          action: "DAILY_DIGEST",
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
          userId: digestUser.id,
        },
      })
      await transaction.user.update({
        data: {
          aiMonthlyUsed: {
            increment: 1,
          },
        },
        where: {
          id: digestUser.id,
        },
      })
    })

    return {
      articleCount: itemData.length,
      digestId,
      status: "COMPLETED" as const,
    }
  } catch (error) {
    const message = digestFailureMessage(error)

    await store.aiDigest.update({
      data: {
        errorMessage: message,
        status: "FAILED",
      },
      where: {
        id: digestId,
      },
    })

    throw new AiDigestError(message)
  }
}

export async function getAiDigestForUser({
  digestId,
  userId,
}: {
  digestId: string
  userId: string
}) {
  return getAiDigestWithClient({
    digestId,
    store: getAiDigestStore(),
    userId,
  })
}

export async function getAiDigestWithClient({
  digestId,
  store,
  userId,
}: {
  digestId: string
  store: AiDigestStore
  userId: string
}) {
  return store.aiDigest.findFirst({
    include: {
      items: {
        orderBy: [{ section: "asc" }, { position: "asc" }],
      },
    },
    where: {
      id: digestId,
      userId,
    },
  })
}

export function createLocalDigestProvider(): AiDigestProvider {
  return {
    model: DEFAULT_LOCAL_DIGEST_MODEL,
    name: "local",
    async generate({ articles, generatedAt }) {
      const ranked = [...articles].sort((left, right) => {
        const aiDifference =
          Number(Boolean(right.aiSummary)) - Number(Boolean(left.aiSummary))

        if (aiDifference !== 0) {
          return aiDifference
        }

        return (
          (right.publishedAt?.getTime() ?? 0) -
          (left.publishedAt?.getTime() ?? 0)
        )
      })
      const items = ranked.map((article, index) => ({
        articleId: article.articleId,
        reason:
          index < 5
            ? "Prioritized from the newest unread stories."
            : "Saved for a quicker follow-up scan.",
        section: (index < 5 ? "MUST_READ" : "SKIM_LATER") as AiDigestSection,
        summary: truncateText(article.aiSummary || article.summary, 420),
        topic:
          compactWhitespace(
            article.category || article.folderName || article.feedTitle
          ) || "General",
      }))
      const overview = `${items.length} unread ${
        items.length === 1 ? "story" : "stories"
      } across ${new Set(items.map((item) => item.topic)).size} ${
        new Set(items.map((item) => item.topic)).size === 1 ? "topic" : "topics"
      }.`

      return {
        inputTokens: estimateTokens(
          articles
            .map((article) => `${article.title} ${article.summary}`)
            .join(" ")
        ),
        items,
        outputTokens: estimateTokens(
          overview + items.map((item) => item.summary).join(" ")
        ),
        overview,
        title: `Arctic digest - ${generatedAt.toISOString().slice(0, 10)}`,
      }
    },
  }
}

export function createOpenAiDigestProvider({
  apiKey,
  fetcher = fetch,
  model,
}: {
  apiKey: string
  fetcher?: typeof fetch
  model: string
}): AiDigestProvider {
  return {
    model,
    name: "openai",
    async generate({ articles, generatedAt }) {
      const response = await fetcher("https://api.openai.com/v1/responses", {
        body: JSON.stringify({
          input: [
            {
              content:
                "Create a concise RSS digest from unread articles. Prioritize the most useful stories, preserve every articleId exactly, and return strict JSON only.",
              role: "system",
            },
            {
              content: JSON.stringify({
                articles: articles.map((article) => ({
                  articleId: article.articleId,
                  category: article.category,
                  feedTitle: article.feedTitle,
                  folderName: article.folderName,
                  publishedAt: article.publishedAt?.toISOString() ?? null,
                  summary: article.aiSummary || article.summary,
                  title: article.title,
                  url: article.url,
                })),
                generatedAt: generatedAt.toISOString(),
              }),
              role: "user",
            },
          ],
          model,
          text: {
            format: {
              name: "rss_digest",
              schema: {
                additionalProperties: false,
                properties: {
                  items: {
                    items: {
                      additionalProperties: false,
                      properties: {
                        articleId: {
                          type: "string",
                        },
                        reason: {
                          type: ["string", "null"],
                        },
                        section: {
                          enum: ["MUST_READ", "SKIM_LATER"],
                          type: "string",
                        },
                        summary: {
                          type: "string",
                        },
                        topic: {
                          type: "string",
                        },
                      },
                      required: [
                        "articleId",
                        "reason",
                        "section",
                        "summary",
                        "topic",
                      ],
                      type: "object",
                    },
                    type: "array",
                  },
                  overview: {
                    type: "string",
                  },
                  title: {
                    type: "string",
                  },
                },
                required: ["title", "overview", "items"],
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

      if (!response.ok) {
        throw new AiDigestError(
          `OpenAI digest request failed (${response.status}).`
        )
      }

      const payload = (await response.json()) as OpenAiDigestResponse
      const parsed = parseOpenAiDigest(payload)

      return {
        inputTokens:
          payload.usage?.input_tokens ??
          estimateTokens(
            articles
              .map((article) => `${article.title} ${article.summary}`)
              .join(" ")
          ),
        items: parsed.items,
        outputTokens:
          payload.usage?.output_tokens ??
          estimateTokens(
            parsed.overview +
              parsed.items.map((item) => item.summary).join(" ")
          ),
        overview: parsed.overview,
        title: parsed.title,
      }
    },
  }
}

export function getAiDigestProvider(): AiDigestProvider {
  if (process.env.AI_PROVIDER?.toLowerCase() === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new AiDigestError(
        "OPENAI_API_KEY is required for OpenAI digests."
      )
    }

    return createOpenAiDigestProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model:
        process.env.AI_DIGEST_MODEL ||
        process.env.AI_DEFAULT_MODEL ||
        DEFAULT_OPENAI_DIGEST_MODEL,
    })
  }

  return createLocalDigestProvider()
}

export function eligibleAiDigestArticleWhere(userId: string) {
  return {
    OR: [{ summary: { not: null } }, { contentText: { not: null } }],
    feed: {
      subscriptions: {
        some: {
          isPaused: false,
          userId,
        },
      },
    },
    states: {
      none: {
        isRead: true,
        userId,
      },
    },
    title: {
      not: "",
    },
  }
}

function mapProviderArticle(article: DigestArticleRecord): AiDigestProviderArticle {
  const latestSummary = article.aiSummaries[0]

  return {
    aiSummary: latestSummary?.shortSummary ?? null,
    articleId: article.id,
    category: latestSummary?.category ?? null,
    feedTitle: article.feed.title,
    folderName: article.feed.subscriptions[0]?.folder?.name ?? null,
    publishedAt: article.publishedAt,
    summary: compactWhitespace(article.summary || article.contentText || ""),
    title: compactWhitespace(article.title),
    url: article.url,
  }
}

function normalizeDigestResult(
  result: AiDigestProviderResult,
  articles: AiDigestProviderArticle[]
) {
  const knownArticleIds = new Set(articles.map((article) => article.articleId))
  const seenArticleIds = new Set<string>()
  const items = result.items
    .filter(
      (item) =>
        knownArticleIds.has(item.articleId) &&
        !seenArticleIds.has(item.articleId) &&
        (item.section === "MUST_READ" || item.section === "SKIM_LATER")
    )
    .map((item) => {
      seenArticleIds.add(item.articleId)

      return {
        articleId: item.articleId,
        reason: nullableText(item.reason, 280),
        section: item.section,
        summary: truncateText(item.summary, 520),
        topic: truncateText(item.topic, 80) || "General",
      }
    })

  if (!items.length) {
    throw new AiDigestError("Digest provider returned no usable articles.")
  }

  return {
    inputTokens: Math.max(0, Math.round(result.inputTokens)),
    items,
    outputTokens: Math.max(0, Math.round(result.outputTokens)),
    overview: truncateText(result.overview, 800),
    title: truncateText(result.title, 160) || "Arctic digest",
  }
}

function digestFailureMessage(error: unknown) {
  if (error instanceof AiDigestError) {
    return truncateText(error.message, 500)
  }

  return "Digest generation failed."
}

function nullableText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null
  }

  return truncateText(value, maxLength) || null
}

function truncateText(value: string, maxLength: number) {
  const compact = compactWhitespace(value)

  if (compact.length <= maxLength) {
    return compact
  }

  return `${compact.slice(0, maxLength - 3).trimEnd()}...`
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function estimateTokens(value: string) {
  const words = compactWhitespace(value).split(/\s+/).filter(Boolean).length

  return Math.ceil(words * 1.35)
}

type OpenAiDigestResponse = {
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

function parseOpenAiDigest(payload: OpenAiDigestResponse) {
  if (isDigestProviderPayload(payload.output_parsed)) {
    return payload.output_parsed
  }

  const outputText =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text

  if (!outputText) {
    throw new AiDigestError("OpenAI returned no digest output.")
  }

  const parsed = JSON.parse(outputText) as unknown

  if (!isDigestProviderPayload(parsed)) {
    throw new AiDigestError("OpenAI returned an invalid digest payload.")
  }

  return parsed
}

function isDigestProviderPayload(
  value: unknown
): value is Omit<AiDigestProviderResult, "inputTokens" | "outputTokens"> {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as {
    items?: unknown
    overview?: unknown
    title?: unknown
  }

  return (
    typeof candidate.title === "string" &&
    typeof candidate.overview === "string" &&
    Array.isArray(candidate.items)
  )
}

function getAiDigestStore() {
  return getPrisma() as unknown as AiDigestStore
}
