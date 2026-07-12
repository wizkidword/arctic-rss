import { getPrisma } from "./db"
import {
  REDDIT_DISCOVER_CATEGORY_ID,
  REDDIT_DISCOVER_CATEGORY_SORT_ORDER,
  getRedditDirectoryFeedBySubreddit,
  redditDirectoryCategory,
  subredditFeedId,
  subredditFeedLabel,
  subredditRssUrl,
} from "./reddit-directory"

export type AddDiscoverSubredditInput = {
  readonly adminUserId: string
  readonly store?: DiscoverSubredditStore
  readonly subredditName?: string | null
}

export type AddDiscoverSubredditResult = {
  readonly feedId: string
  readonly label: string
  readonly subredditName: string
  readonly url: string
}

type DiscoverSubredditStore = {
  adminAuditLog: {
    create(args: {
      data: {
        action: string
        adminUserId: string
        metadata: Record<string, unknown>
        targetId: string
        targetType: string
      }
    }): Promise<unknown>
  }
  discoverCategory: {
    upsert(args: {
      create: {
        countryCode: string | null
        description: string
        label: string
        slug: string
        sortOrder: number
      }
      update: {
        countryCode: string | null
        description: string
        label: string
        sortOrder: number
      }
      where: {
        slug: string
      }
    }): Promise<{ id: string }>
  }
  discoverFeed: {
    create(args: {
      data: {
        aliases: string[]
        categoryId: string
        label: string
        slug: string
        sortOrder: number
        source: string
        url: string
      }
    }): Promise<unknown>
    findUnique(args: {
      select: {
        id: true
        label: true
      }
      where: {
        slug: string
      }
    }): Promise<{ id: string; label: string } | null>
  }
}

export class DiscoverSubredditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DiscoverSubredditError"
  }
}

export async function addDiscoverSubredditToRedditTopic({
  adminUserId,
  store = getDiscoverSubredditStore(),
  subredditName,
}: AddDiscoverSubredditInput): Promise<AddDiscoverSubredditResult> {
  const normalizedSubredditName = normalizeSubredditName(subredditName)

  if (!normalizedSubredditName) {
    throw new DiscoverSubredditError("Enter a subreddit name.")
  }

  if (!/^[A-Za-z0-9_]{2,21}$/.test(normalizedSubredditName)) {
    throw new DiscoverSubredditError(
      "Subreddit names can only use letters, numbers, and underscores."
    )
  }

  const seededFeed = getRedditDirectoryFeedBySubreddit(normalizedSubredditName)

  if (seededFeed) {
    throw new DiscoverSubredditError(
      `${seededFeed.label} is already in the Reddit topic.`
    )
  }

  const feedId = subredditFeedId(normalizedSubredditName)
  const existingFeed = await store.discoverFeed.findUnique({
    select: {
      id: true,
      label: true,
    },
    where: {
      slug: feedId,
    },
  })

  if (existingFeed) {
    throw new DiscoverSubredditError(
      `${existingFeed.label} is already in the Reddit topic.`
    )
  }

  const category = await store.discoverCategory.upsert({
    create: {
      countryCode: null,
      description: redditDirectoryCategory.description,
      label: redditDirectoryCategory.label,
      slug: REDDIT_DISCOVER_CATEGORY_ID,
      sortOrder: REDDIT_DISCOVER_CATEGORY_SORT_ORDER,
    },
    update: {
      countryCode: null,
      description: redditDirectoryCategory.description,
      label: redditDirectoryCategory.label,
      sortOrder: REDDIT_DISCOVER_CATEGORY_SORT_ORDER,
    },
    where: {
      slug: REDDIT_DISCOVER_CATEGORY_ID,
    },
  })
  const label = subredditFeedLabel(normalizedSubredditName)
  const url = subredditRssUrl(normalizedSubredditName)

  await store.discoverFeed.create({
    data: {
      aliases: [],
      categoryId: category.id,
      label,
      slug: feedId,
      sortOrder: REDDIT_DISCOVER_CATEGORY_SORT_ORDER,
      source: "reddit.com",
      url,
    },
  })

  await store.adminAuditLog.create({
    data: {
      action: "DISCOVER_SUBREDDIT_ADD",
      adminUserId,
      metadata: {
        feedId,
        subredditName: normalizedSubredditName,
        url,
      },
      targetId: feedId,
      targetType: "DiscoverFeed",
    },
  })

  return {
    feedId,
    label,
    subredditName: normalizedSubredditName,
    url,
  }
}

export function normalizeSubredditName(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return ""
  }

  try {
    const url = new URL(trimmed)
    const pathParts = url.pathname.split("/").filter(Boolean)
    const subredditSegmentIndex = pathParts.findIndex(
      (part) => part.toLowerCase() === "r"
    )

    if (subredditSegmentIndex !== -1) {
      return pathParts[subredditSegmentIndex + 1]?.trim() ?? ""
    }
  } catch {
    // Not a full URL; continue with r/name normalization below.
  }

  return trimmed
    .replace(/^\/?r\//i, "")
    .replace(/\/?\.rss$/i, "")
    .replace(/\/+$/g, "")
    .trim()
}

function getDiscoverSubredditStore() {
  return getPrisma() as unknown as DiscoverSubredditStore
}
