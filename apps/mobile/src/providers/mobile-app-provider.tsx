import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, AppState, View } from "react-native"

import {
  MobileApiClient,
  MobileApiError,
  MobileSessionManager,
} from "@arctic-rss/mobile-client"

import { beginBrowserMobileLogin } from "@/auth/browser-login"
import { nativeSessionStore } from "@/auth/native-session-store"
import { MOBILE_SERVICE_ORIGIN } from "@/config"
import { MobileOfflineStore } from "@/storage/mobile-offline-store"
import { flushPendingMutations } from "@/sync/flush-pending-mutations"
import {
  MobileForegroundCoordinator,
  type MobileForegroundSyncSnapshot,
} from "@/sync/mobile-foreground-coordinator"
import { synchronizeMobileState } from "@/sync/synchronize-mobile-state"

type MobileAppContextValue = {
  api: MobileApiClient
  isReady: boolean
  isSignedIn: boolean
  offline: MobileOfflineStore
  ownerScope: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  syncNow: (options?: { returnSession?: boolean }) => Promise<void>
  syncRevision: number
  syncSnapshot: MobileForegroundSyncSnapshot
}

const MobileAppContext = createContext<MobileAppContextValue | null>(null)
const INITIAL_SYNC_SNAPSHOT: MobileForegroundSyncSnapshot = {
  conflictCount: 0,
  lastSuccessfulSyncAt: null,
  state: "idle",
}

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [ownerScope, setOwnerScope] = useState<string | null>(null)
  const [syncRevision, setSyncRevision] = useState(0)
  const [syncSnapshot, setSyncSnapshot] = useState<MobileForegroundSyncSnapshot>(INITIAL_SYNC_SNAPSHOT)
  const appState = useRef(AppState.currentState)
  const offline = useMemo(() => new MobileOfflineStore(), [])
  const unauthenticatedApi = useMemo(
    () =>
      new MobileApiClient({
        allowInsecureDevelopmentOrigin: __DEV__,
        origin: MOBILE_SERVICE_ORIGIN,
      }),
    []
  )
  const session = useMemo(
    () =>
      new MobileSessionManager(nativeSessionStore, {
        refresh: async (refreshToken) => (await unauthenticatedApi.refreshSession(refreshToken)).data,
      }, {
        isRetryableFailure: (error) => error instanceof MobileApiError && error.retryable,
      }),
    [unauthenticatedApi]
  )
  const api = useMemo(
    () =>
      new MobileApiClient({
        allowInsecureDevelopmentOrigin: __DEV__,
        getAccessToken: () => session.getAccessToken(),
        origin: MOBILE_SERVICE_ORIGIN,
        refreshAccessToken: () => session.refreshAccessToken(),
      }),
    [session]
  )
  const clearInvalidSession = useCallback(async () => {
    await session.clear()
    await offline.purgeForLogout()
    setOwnerScope(null)
    setIsSignedIn(false)
  }, [offline, session])
  const coordinator = useMemo(
    () =>
      new MobileForegroundCoordinator({
        claimOwner: async () => {
          const owner = session.getOwner()
          if (!owner) {
            throw new MobileApiError(
              "MOBILE_DEVICE_SESSION_REQUIRED",
              "Sign in to Arctic RSS before continuing.",
              false,
              401
            )
          }
          await offline.claimOwner(owner)
        },
        flush: () => flushPendingMutations(api, offline),
        onStateChange: (snapshot) => {
          setSyncSnapshot(snapshot)
          if (snapshot.state === "conflicts" || snapshot.state === "idle") {
            setSyncRevision((revision) => revision + 1)
          }
        },
        sync: (options) => synchronizeMobileState(api, offline, options),
      }),
    [api, offline, session]
  )
  const syncNow = useCallback(async (options: { returnSession?: boolean } = {}) => {
    try {
      await coordinator.request(options)
    } catch (error) {
      if (isTerminalMobileSessionFailure(error) || !session.isSignedIn()) {
        await clearInvalidSession()
      }
      throw error
    }
  }, [clearInvalidSession, coordinator, session])

  useEffect(() => {
    let current = true
    void session
      .hydrate()
      .then(async (signedIn) => {
        if (!current) {
          return
        }
        if (!signedIn) {
          await offline.purgeForLogout()
        }
        if (signedIn) {
          const owner = session.getOwner()
          if (!owner) {
            await clearInvalidSession()
            return
          }
          try {
            await syncNow()
          } catch {
            // A future foreground request retries; no request body or token is logged.
          }
          if (!session.isSignedIn()) {
            return
          }
          setOwnerScope(mobileOwnerScope(owner))
        }
        if (current) {
          setIsSignedIn(signedIn && session.isSignedIn())
          setIsReady(true)
        }
      })
      .catch(() => {
        if (current) {
          void offline.purgeForLogout()
          setIsSignedIn(false)
          setIsReady(true)
        }
      })
    return () => {
      current = false
    }
  }, [clearInvalidSession, offline, session, syncNow])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const becameActive = appState.current !== "active" && nextState === "active"
      appState.current = nextState
      if (becameActive && session.isSignedIn()) {
        void syncNow({ returnSession: true }).catch(() => {
          // Network recovery retries in the foreground without logging tokens or request bodies.
        })
      }
    })
    return () => subscription.remove()
  }, [session, syncNow])

  const signIn = useCallback(async () => {
    const tokens = await beginBrowserMobileLogin({ api: unauthenticatedApi, origin: MOBILE_SERVICE_ORIGIN })
    await session.setTokens(tokens)
    const owner = session.getOwner()
    if (!owner) {
      await clearInvalidSession()
      throw new Error("Arctic RSS could not establish local device ownership. Sign in again.")
    }
    try {
      await syncNow()
    } catch {
      if (!session.isSignedIn()) {
        throw new Error("This device session is no longer authorized. Sign in again.")
      }
      // The completed sign-in remains valid; the next foreground sync retries queued writes.
    }
    setOwnerScope(mobileOwnerScope(owner))
    setIsSignedIn(true)
  }, [clearInvalidSession, session, syncNow, unauthenticatedApi])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Local logout must still remove this device's sensitive and cached state.
    } finally {
      await clearInvalidSession()
    }
  }, [api, clearInvalidSession])

  const value = useMemo(
    () => ({ api, isReady, isSignedIn, offline, ownerScope, signIn, signOut, syncNow, syncRevision, syncSnapshot }),
    [api, isReady, isSignedIn, offline, ownerScope, signIn, signOut, syncNow, syncRevision, syncSnapshot]
  )

  if (!isReady) {
    return (
      <View accessibilityLabel="Preparing Arctic RSS" style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    )
  }
  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>
}

function isTerminalMobileSessionFailure(error: unknown) {
  return error instanceof MobileApiError && error.status === 401
}

function mobileOwnerScope(owner: { mobileDeviceId: string; userId: string }) {
  return `${owner.userId}:${owner.mobileDeviceId}`
}

export function useMobileApp() {
  const context = useContext(MobileAppContext)
  if (!context) {
    throw new Error("useMobileApp must be used inside MobileAppProvider.")
  }
  return context
}
