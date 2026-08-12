import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, AppState, View } from "react-native"

import {
  MobileApiClient,
  MobileApiError,
  MobileSessionManager,
} from "@arctic-rss/mobile-client"

import { beginBrowserMobileLogin } from "@/auth/browser-login"
import {
  clearLocalMobileData,
  type LocalSessionCleanupState,
} from "@/auth/local-session-cleanup"
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
  localSessionState: LocalSessionState
  offline: MobileOfflineStore
  ownerScope: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  syncNow: (options?: { returnSession?: boolean }) => Promise<void>
  syncRevision: number
  syncSnapshot: MobileForegroundSyncSnapshot
  retryLocalCleanup: () => Promise<void>
}

export type LocalSessionState = "preparing" | "signed-in" | "signing-out" | LocalSessionCleanupState

const MobileAppContext = createContext<MobileAppContextValue | null>(null)
const INITIAL_SYNC_SNAPSHOT: MobileForegroundSyncSnapshot = {
  conflictCount: 0,
  lastSuccessfulSyncAt: null,
  state: "idle",
}

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [localSessionState, setLocalSessionState] = useState<LocalSessionState>("preparing")
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
  const clearLocalSession = useCallback(async () => {
    // The protected route group must disappear before either persistent cleanup
    // promise settles. A failed cleanup is never treated as a normal sign-out.
    setLocalSessionState("signing-out")
    setOwnerScope(null)
    setSyncSnapshot(INITIAL_SYNC_SNAPSHOT)
    const outcome = await clearLocalMobileData({
      clearSession: () => session.clear(),
      purgeOfflineData: () => offline.purgeForLogout(),
    })
    setLocalSessionState(outcome)
    return outcome === "signed-out-clean"
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
        await clearLocalSession()
      }
      throw error
    }
  }, [clearLocalSession, coordinator, session])

  useEffect(() => {
    let current = true
    void (async () => {
      try {
        const signedIn = await session.hydrate()
        if (!current) {
          return
        }
        if (!signedIn) {
          await clearLocalSession()
          return
        }
        const owner = session.getOwner()
        if (!owner) {
          await clearLocalSession()
          return
        }
        try {
          await offline.claimOwner(owner)
        } catch {
          await clearLocalSession()
          return
        }
        if (!current || !session.isSignedIn()) {
          return
        }
        setOwnerScope(mobileOwnerScope(owner))
        setLocalSessionState("signed-in")
        try {
          await syncNow()
        } catch {
          // A future foreground request retries; no request body or token is logged.
        }
      } catch {
        if (current) {
          await clearLocalSession()
        }
      }
    })()
    return () => {
      current = false
    }
  }, [clearLocalSession, offline, session, syncNow])

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
    if (localSessionState !== "signed-out-clean") {
      throw new Error("Finish clearing local data before signing in to another account.")
    }
    const tokens = await beginBrowserMobileLogin({ api: unauthenticatedApi, origin: MOBILE_SERVICE_ORIGIN })
    try {
      await session.setTokens(tokens)
      const owner = session.getOwner()
      if (!owner) {
        throw new Error("Arctic RSS could not establish local device ownership. Sign in again.")
      }
      await offline.claimOwner(owner)
      setOwnerScope(mobileOwnerScope(owner))
      setLocalSessionState("signed-in")
    } catch {
      await clearLocalSession()
      throw new Error("Arctic RSS could not safely establish local account ownership. Sign in again after cleanup.")
    }
    try {
      await syncNow()
    } catch {
      if (!session.isSignedIn()) {
        throw new Error("This device session is no longer authorized. Sign in again after cleanup.")
      }
      // A completed, owner-scoped sign-in remains valid; foreground sync
      // retries recover network-only failures without crossing account scope.
    }
  }, [clearLocalSession, localSessionState, offline, session, syncNow, unauthenticatedApi])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Local logout must still remove this device's sensitive and cached state.
    } finally {
      await clearLocalSession()
    }
  }, [api, clearLocalSession])

  const retryLocalCleanup = useCallback(async () => {
    await clearLocalSession()
  }, [clearLocalSession])

  const isReady = localSessionState !== "preparing"
  const isSignedIn = localSessionState === "signed-in"

  const value = useMemo(
    () => ({
      api,
      isReady,
      isSignedIn,
      localSessionState,
      offline,
      ownerScope,
      retryLocalCleanup,
      signIn,
      signOut,
      syncNow,
      syncRevision,
      syncSnapshot,
    }),
    [api, isReady, isSignedIn, localSessionState, offline, ownerScope, retryLocalCleanup, signIn, signOut, syncNow, syncRevision, syncSnapshot]
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
