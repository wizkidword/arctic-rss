import { useCallback, useEffect, useState } from "react"

import { useMobileApp } from "@/providers/mobile-app-provider"

export function useMobileQuery<T>(cacheKey: string, load: (signal: AbortSignal) => Promise<T>) {
  const { isSignedIn, offline, ownerScope, syncRevision } = useMobileApp()
  const [data, setData] = useState<T | null>(null)
  const [dataCacheKey, setDataCacheKey] = useState<string | null>(null)
  const [dataOwnerScope, setDataOwnerScope] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasOfflineCopy, setHasOfflineCopy] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!isSignedIn || !ownerScope) {
      return
    }

    let active = true
    const controller = new AbortController()
    void (async () => {
      setIsRefreshing(true)
      setError(null)
      try {
        const cached = await offline.cached<T>(cacheKey)
        if (active && cached !== null) {
          setData(cached)
          setDataCacheKey(cacheKey)
          setDataOwnerScope(ownerScope)
          setHasOfflineCopy(true)
        }
      } catch {
        // A damaged local cache must not prevent a fresh authorized request.
      }
      try {
        const fresh = await load(controller.signal)
        try {
          await offline.cache(cacheKey, fresh)
          if (active) {
            setHasOfflineCopy(true)
          }
        } catch {
          // Rendering fresh data is still safe when local cache maintenance fails.
        }
        if (active) {
          setData(fresh)
          setDataCacheKey(cacheKey)
          setDataOwnerScope(ownerScope)
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return
        }
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Arctic RSS could not load this screen."
          )
        }
      } finally {
        if (active) {
          setIsRefreshing(false)
        }
      }
    })()
    return () => {
      active = false
      controller.abort()
    }
  }, [cacheKey, isSignedIn, load, offline, ownerScope, refreshKey, syncRevision])

  return {
    data: isSignedIn && dataCacheKey === cacheKey && dataOwnerScope === ownerScope ? data : null,
    error,
    hasOfflineCopy: isSignedIn && dataCacheKey === cacheKey && dataOwnerScope === ownerScope && hasOfflineCopy,
    isRefreshing,
    refresh: useCallback(() => setRefreshKey((value) => value + 1), []),
  }
}
