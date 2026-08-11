import { useCallback, useEffect, useRef, useState } from "react"

import { mergeMobilePageItems } from "@/lib/mobile-pagination"
import { useMobileApp } from "@/providers/mobile-app-provider"

type MobilePageResponse = {
  meta: { nextCursor?: string | null }
}

type CachedMobilePage<T> = {
  isTruncated: boolean
  items: T[]
  nextCursor: string | null
}

export function useMobilePagination<TResponse extends MobilePageResponse, TItem>(
  cacheKey: string,
  load: ({ cursor, signal }: { cursor?: string; signal: AbortSignal }) => Promise<TResponse>,
  itemsFromResponse: (response: TResponse) => TItem[],
  itemId: (item: TItem) => string
) {
  const { isSignedIn, offline, ownerScope, syncRevision } = useMobileApp()
  const [error, setError] = useState<string | null>(null)
  const [hasOfflineCopy, setHasOfflineCopy] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [isTruncated, setIsTruncated] = useState(false)
  const [items, setItems] = useState<TItem[]>([])
  const [itemsCacheKey, setItemsCacheKey] = useState<string | null>(null)
  const [itemsOwnerScope, setItemsOwnerScope] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const initialRequest = useRef<AbortController | null>(null)
  const itemsRef = useRef<TItem[]>([])
  const loadMoreRequest = useRef<AbortController | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const paginationGeneration = useRef(0)

  const commitPage = useCallback(({
    append,
    entry,
    scope,
  }: {
    append: boolean
    entry: CachedMobilePage<TItem>
    scope: string
  }) => {
    const merged = append
      ? mergeMobilePageItems(itemsRef.current, entry.items, itemId)
      : mergeMobilePageItems([], entry.items, itemId)
    const truncated = entry.isTruncated || merged.isTruncated
    const followingCursor = truncated ? null : entry.nextCursor
    const committed: CachedMobilePage<TItem> = {
      isTruncated: truncated,
      items: merged.items,
      nextCursor: followingCursor,
    }
    itemsRef.current = committed.items
    nextCursorRef.current = committed.nextCursor
    setItems(committed.items)
    setItemsCacheKey(cacheKey)
    setItemsOwnerScope(scope)
    setIsTruncated(committed.isTruncated)
    setNextCursor(committed.nextCursor)
    return committed
  }, [cacheKey, itemId])

  useEffect(() => {
    if (!isSignedIn || !ownerScope) {
      return
    }
    const generation = paginationGeneration.current + 1
    paginationGeneration.current = generation
    initialRequest.current?.abort()
    loadMoreRequest.current?.abort()
    const controller = new AbortController()
    initialRequest.current = controller
    let active = true
    const pageCacheKey = `mobile-page:${cacheKey}`
    void (async () => {
      setError(null)
      setIsLoadingMore(false)
      setIsRefreshing(true)
      try {
        const cached = await offline.cached<CachedMobilePage<TItem>>(pageCacheKey)
        if (active && isCachedMobilePage(cached)) {
          commitPage({ append: false, entry: cached, scope: ownerScope })
          setHasOfflineCopy(true)
        }
      } catch {
        // A damaged local page must not prevent a fresh authorized request.
      }
      try {
        const response = await load({ signal: controller.signal })
        if (!active || paginationGeneration.current !== generation) {
          return
        }
        const committed = commitPage({
          append: false,
          entry: {
            isTruncated: false,
            items: itemsFromResponse(response),
            nextCursor: response.meta.nextCursor ?? null,
          },
          scope: ownerScope,
        })
        try {
          await offline.cache(pageCacheKey, committed)
          if (active && paginationGeneration.current === generation) {
            setHasOfflineCopy(true)
          }
        } catch {
          // A fresh page remains valid when bounded local cache maintenance fails.
        }
      } catch (caught) {
        if (!controller.signal.aborted && active && paginationGeneration.current === generation) {
          setError(caught instanceof Error ? caught.message : "Arctic RSS could not load this page.")
        }
      } finally {
        if (active && paginationGeneration.current === generation) {
          setIsRefreshing(false)
        }
      }
    })()
    return () => {
      active = false
      controller.abort()
    }
  }, [cacheKey, commitPage, isSignedIn, itemsFromResponse, load, offline, ownerScope, refreshKey, syncRevision])

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current
    if (!isSignedIn || !ownerScope || !cursor || isTruncated || loadMoreRequest.current) {
      return
    }
    const generation = paginationGeneration.current
    const controller = new AbortController()
    loadMoreRequest.current = controller
    setError(null)
    setIsLoadingMore(true)
    try {
      const response = await load({ cursor, signal: controller.signal })
      if (paginationGeneration.current !== generation) {
        return
      }
      const committed = commitPage({
        append: true,
        entry: {
          isTruncated: false,
          items: itemsFromResponse(response),
          nextCursor: response.meta.nextCursor ?? null,
        },
        scope: ownerScope,
      })
      try {
        await offline.cache(`mobile-page:${cacheKey}`, committed)
        if (paginationGeneration.current === generation) {
          setHasOfflineCopy(true)
        }
      } catch {
        // The visible merged page remains valid without a local cache write.
      }
    } catch (caught) {
      if (!controller.signal.aborted && paginationGeneration.current === generation) {
        setError(caught instanceof Error ? caught.message : "Arctic RSS could not load more items.")
      }
    } finally {
      if (loadMoreRequest.current === controller) {
        loadMoreRequest.current = null
      }
      if (paginationGeneration.current === generation) {
        setIsLoadingMore(false)
      }
    }
  }, [cacheKey, commitPage, isSignedIn, isTruncated, itemsFromResponse, load, offline, ownerScope])

  const currentPage = isSignedIn && itemsCacheKey === cacheKey && itemsOwnerScope === ownerScope

  return {
    error,
    hasNextPage: currentPage && nextCursor !== null && !isTruncated,
    hasOfflineCopy: currentPage && hasOfflineCopy,
    isLoadingMore,
    isRefreshing,
    isTruncated: currentPage && isTruncated,
    items: currentPage ? items : [],
    loadMore,
    refresh: useCallback(() => setRefreshKey((value) => value + 1), []),
  }
}

function isCachedMobilePage<T>(value: unknown): value is CachedMobilePage<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as CachedMobilePage<T>).items) &&
      typeof (value as CachedMobilePage<T>).isTruncated === "boolean" &&
      ((value as CachedMobilePage<T>).nextCursor === null || typeof (value as CachedMobilePage<T>).nextCursor === "string")
  )
}
