import { useCallback, useEffect, useState } from "react"

import { MobileApiError } from "@arctic-rss/mobile-client"

import { useMobileApp } from "@/providers/mobile-app-provider"

export function useMobileQuery<T>(cacheKey: string, load: () => Promise<T>) {
  const { offline, signOut } = useMobileApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      setIsRefreshing(true)
      setError(null)
      try {
        const cached = await offline.cached<T>(cacheKey)
        if (active && cached !== null) {
          setData(cached)
        }
      } catch {
        // A damaged local cache must not prevent a fresh authorized request.
      }
      try {
        const fresh = await load()
        try {
          await offline.cache(cacheKey, fresh)
        } catch {
          // Rendering fresh data is still safe when local cache maintenance fails.
        }
        if (active) {
          setData(fresh)
        }
      } catch (caught) {
        if (caught instanceof MobileApiError && caught.status === 401) {
          await signOut()
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
    }
  }, [cacheKey, load, offline, refreshKey, signOut])

  return {
    data,
    error,
    isRefreshing,
    refresh: useCallback(() => setRefreshKey((value) => value + 1), []),
  }
}
