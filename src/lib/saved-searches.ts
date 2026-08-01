import { cache } from "react"

import {
  articleSearchHref,
  ARTICLE_SEARCH_QUERY_VERSION,
  type ArticleSearchFilters,
  type ArticleSearchState,
} from "./article-search"
import { getPrisma } from "./db"

const MAX_SAVED_SEARCH_DESCRIPTION_LENGTH = 500
const MAX_SAVED_SEARCH_NAME_LENGTH = 80

export type SavedSearchMonitorAction = "count" | "star"

type OwnedRecord = {
  id: string
}

export type SavedSearchRecord = {
  collectionId: string | null
  createdAt: Date
  definitionVersion: number
  description: string | null
  folderId: string | null
  id: string
  monitorCursorArticleId: string | null
  monitorCursorCreatedAt: Date | null
  monitorAction: SavedSearchMonitorAction
  monitorEnabled: boolean
  monitorLastRunAt: Date | null
  monitorNewMatchCount: number
  monitorNextRunAt: Date | null
  name: string
  publishedAfter: Date | null
  publishedBefore: Date | null
  query: string
  state: string
  subscriptionId: string | null
  updatedAt: Date
  userId: string
}

type SavedSearchStore = {
  articleCollection: {
    findFirst(args: {
      select: { id: true }
      where: { id: string; userId: string }
    }): Promise<OwnedRecord | null>
  }
  feedSubscription: {
    findFirst(args: {
      select: { id: true }
      where: { id: string; userId: string }
    }): Promise<OwnedRecord | null>
  }
  folder: {
    findFirst(args: {
      select: { id: true }
      where: { id: string; userId: string }
    }): Promise<OwnedRecord | null>
  }
  savedSearch: {
    create(args: {
      data: Omit<
        SavedSearchRecord,
        | "createdAt"
        | "id"
        | "monitorCursorArticleId"
        | "monitorCursorCreatedAt"
        | "monitorAction"
        | "monitorEnabled"
        | "monitorLastRunAt"
        | "monitorNewMatchCount"
        | "monitorNextRunAt"
        | "updatedAt"
      >
    }): Promise<SavedSearchRecord>
    deleteMany(args: {
      where: { id: string; userId: string }
    }): Promise<{ count: number }>
    findMany(args: {
      orderBy: Array<{ updatedAt: "desc" }>
      where: { userId: string }
    }): Promise<SavedSearchRecord[]>
    updateMany(args: {
      data: Record<string, unknown>
      where: { id: string; userId: string }
    }): Promise<{ count: number }>
  }
}

export type SavedSearchInput = {
  description?: string
  filters: ArticleSearchFilters
  name: string
}

export class SavedSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SavedSearchError"
  }
}

export const listSavedSearchesForUser = cache(
  async function listSavedSearchesForUser(userId: string) {
    return listSavedSearchesForUserWithClient({
      store: getSavedSearchStore(),
      userId,
    })
  }
)

export async function listSavedSearchesForUserWithClient({
  store,
  userId,
}: {
  store: SavedSearchStore
  userId: string
}) {
  return store.savedSearch.findMany({
    orderBy: [{ updatedAt: "desc" }],
    where: { userId },
  })
}

export async function createSavedSearchForUser({
  input,
  userId,
}: {
  input: SavedSearchInput
  userId: string
}) {
  return createSavedSearchForUserWithClient({
    input,
    store: getSavedSearchStore(),
    userId,
  })
}

export async function createSavedSearchForUserWithClient({
  input,
  store,
  userId,
}: {
  input: SavedSearchInput
  store: SavedSearchStore
  userId: string
}) {
  const filters = normalizeSavedSearchFilters(input.filters)
  const name = normalizeSavedSearchName(input.name)
  const description = normalizeSavedSearchDescription(input.description)

  await assertFiltersBelongToUser({ filters, store, userId })

  return store.savedSearch.create({
    data: {
      collectionId: filters.collectionId ?? null,
      definitionVersion: ARTICLE_SEARCH_QUERY_VERSION,
      description,
      folderId: filters.folderId ?? null,
      name,
      publishedAfter: filters.publishedAfter ?? null,
      publishedBefore: filters.publishedBefore ?? null,
      query: filters.query,
      state: filters.state,
      subscriptionId: filters.subscriptionId ?? null,
      userId,
    },
  })
}

export async function deleteSavedSearchForUser({
  savedSearchId,
  userId,
}: {
  savedSearchId: string
  userId: string
}) {
  return deleteSavedSearchForUserWithClient({
    savedSearchId,
    store: getSavedSearchStore(),
    userId,
  })
}

export async function deleteSavedSearchForUserWithClient({
  savedSearchId,
  store,
  userId,
}: {
  savedSearchId: string
  store: SavedSearchStore
  userId: string
}) {
  const id = savedSearchId.trim()

  if (!id || id.length > 128) {
    throw new SavedSearchError("Saved search not found.")
  }

  const result = await store.savedSearch.deleteMany({
    where: { id, userId },
  })

  if (!result.count) {
    throw new SavedSearchError("Saved search not found.")
  }
}

export async function setSavedSearchMonitorEnabledForUser({
  enabled,
  now = new Date(),
  savedSearchId,
  userId,
}: {
  enabled: boolean
  now?: Date
  savedSearchId: string
  userId: string
}) {
  return setSavedSearchMonitorEnabledForUserWithClient({
    enabled,
    now,
    savedSearchId,
    store: getSavedSearchStore(),
    userId,
  })
}

export async function setSavedSearchMonitorEnabledForUserWithClient({
  enabled,
  now = new Date(),
  savedSearchId,
  store,
  userId,
}: {
  enabled: boolean
  now?: Date
  savedSearchId: string
  store: SavedSearchStore
  userId: string
}) {
  const id = normalizeSavedSearchIdentifier(savedSearchId)

  const result = await store.savedSearch.updateMany({
    data: enabled
      ? {
          monitorCursorArticleId: "",
          monitorCursorCreatedAt: now,
          monitorEnabled: true,
          monitorLastRunAt: null,
          monitorNextRunAt: now,
        }
      : {
          monitorEnabled: false,
          monitorNextRunAt: null,
        },
    where: { id, userId },
  })

  if (!result.count) {
    throw new SavedSearchError("Saved search not found.")
  }
}

export async function setSavedSearchMonitorActionForUser({
  action,
  savedSearchId,
  userId,
}: {
  action: string
  savedSearchId: string
  userId: string
}) {
  return setSavedSearchMonitorActionForUserWithClient({
    action,
    savedSearchId,
    store: getSavedSearchStore(),
    userId,
  })
}

export async function setSavedSearchMonitorActionForUserWithClient({
  action,
  savedSearchId,
  store,
  userId,
}: {
  action: string
  savedSearchId: string
  store: SavedSearchStore
  userId: string
}) {
  if (!isSavedSearchMonitorAction(action)) {
    throw new SavedSearchError("Saved search action is unavailable.")
  }

  const result = await store.savedSearch.updateMany({
    data: { monitorAction: action },
    where: { id: normalizeSavedSearchIdentifier(savedSearchId), userId },
  })

  if (!result.count) {
    throw new SavedSearchError("Saved search not found.")
  }
}

export async function acknowledgeSavedSearchMonitorForUser({
  savedSearchId,
  userId,
}: {
  savedSearchId: string
  userId: string
}) {
  return acknowledgeSavedSearchMonitorForUserWithClient({
    savedSearchId,
    store: getSavedSearchStore(),
    userId,
  })
}

export async function acknowledgeSavedSearchMonitorForUserWithClient({
  savedSearchId,
  store,
  userId,
}: {
  savedSearchId: string
  store: SavedSearchStore
  userId: string
}) {
  const result = await store.savedSearch.updateMany({
    data: { monitorNewMatchCount: 0 },
    where: { id: normalizeSavedSearchIdentifier(savedSearchId), userId },
  })

  if (!result.count) {
    throw new SavedSearchError("Saved search not found.")
  }
}

export function savedSearchHref(savedSearch: SavedSearchRecord) {
  return articleSearchHref(savedSearchFilters(savedSearch))
}

export function savedSearchFilters(
  savedSearch: Pick<
    SavedSearchRecord,
    | "collectionId"
    | "folderId"
    | "publishedAfter"
    | "publishedBefore"
    | "query"
    | "state"
    | "subscriptionId"
  >
): ArticleSearchFilters {
  return {
    collectionId: savedSearch.collectionId ?? undefined,
    folderId: savedSearch.folderId ?? undefined,
    publishedAfter: savedSearch.publishedAfter ?? undefined,
    publishedBefore: savedSearch.publishedBefore ?? undefined,
    query: savedSearch.query,
    state: normalizeSearchState(savedSearch.state),
    subscriptionId: savedSearch.subscriptionId ?? undefined,
  }
}

function normalizeSavedSearchFilters(
  filters: ArticleSearchFilters
): ArticleSearchFilters {
  const query = filters.query.trim().replace(/\s+/g, " ")

  if (!query) {
    throw new SavedSearchError("Enter a search phrase before saving it.")
  }

  if (query.length > 200) {
    throw new SavedSearchError("Search phrases must be 200 characters or fewer.")
  }

  return {
    collectionId: normalizeIdentifier(filters.collectionId),
    folderId: normalizeIdentifier(filters.folderId),
    publishedAfter: normalizeDate(filters.publishedAfter),
    publishedBefore: normalizeDate(filters.publishedBefore),
    query,
    state: normalizeSearchState(filters.state),
    subscriptionId: normalizeIdentifier(filters.subscriptionId),
  }
}

async function assertFiltersBelongToUser({
  filters,
  store,
  userId,
}: {
  filters: ArticleSearchFilters
  store: SavedSearchStore
  userId: string
}) {
  const [collection, folder, subscription] = await Promise.all([
    filters.collectionId
      ? store.articleCollection.findFirst({
          select: { id: true },
          where: { id: filters.collectionId, userId },
        })
      : null,
    filters.folderId
      ? store.folder.findFirst({
          select: { id: true },
          where: { id: filters.folderId, userId },
        })
      : null,
    filters.subscriptionId
      ? store.feedSubscription.findFirst({
          select: { id: true },
          where: { id: filters.subscriptionId, userId },
        })
      : null,
  ])

  if (
    (filters.collectionId && !collection) ||
    (filters.folderId && !folder) ||
    (filters.subscriptionId && !subscription)
  ) {
    throw new SavedSearchError("A selected search filter is unavailable.")
  }
}

function normalizeSavedSearchName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ")

  if (!normalized) {
    throw new SavedSearchError("Saved search name is required.")
  }

  if (normalized.length > MAX_SAVED_SEARCH_NAME_LENGTH) {
    throw new SavedSearchError(
      `Saved search names must be ${MAX_SAVED_SEARCH_NAME_LENGTH} characters or fewer.`
    )
  }

  return normalized
}

function normalizeSavedSearchDescription(value: string | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? ""

  if (normalized.length > MAX_SAVED_SEARCH_DESCRIPTION_LENGTH) {
    throw new SavedSearchError(
      `Saved search descriptions must be ${MAX_SAVED_SEARCH_DESCRIPTION_LENGTH} characters or fewer.`
    )
  }

  return normalized || null
}

function normalizeIdentifier(value: string | undefined) {
  const normalized = value?.trim()

  return normalized && normalized.length <= 128 ? normalized : undefined
}

function normalizeSavedSearchIdentifier(value: string) {
  const id = value.trim()

  if (!id || id.length > 128) {
    throw new SavedSearchError("Saved search not found.")
  }

  return id
}

function isSavedSearchMonitorAction(value: string): value is SavedSearchMonitorAction {
  return value === "count" || value === "star"
}

function normalizeDate(value: Date | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return undefined
  }

  return value
}

function normalizeSearchState(value: string): ArticleSearchState {
  return value === "read" || value === "starred" || value === "unread"
    ? value
    : "all"
}

function getSavedSearchStore() {
  return getPrisma() as unknown as SavedSearchStore
}
