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
import { synchronizeMobileState } from "@/sync/synchronize-mobile-state"

type MobileAppContextValue = {
  api: MobileApiClient
  isReady: boolean
  isSignedIn: boolean
  offline: MobileOfflineStore
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const MobileAppContext = createContext<MobileAppContextValue | null>(null)

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
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
      }),
    [session]
  )
  const clearInvalidSession = useCallback(async () => {
    await session.clear()
    await offline.purgeForLogout()
    setIsSignedIn(false)
  }, [offline, session])

  useEffect(() => {
    let current = true
    void session
      .hydrate()
      .then(async (signedIn) => {
        if (!current) {
          return
        }
        setIsSignedIn(signedIn)
        if (signedIn) {
          try {
            await flushPendingMutations(api, offline)
            await synchronizeMobileState(api, offline)
          } catch (error) {
            if (isTerminalMobileSessionFailure(error) || !session.isSignedIn()) {
              await clearInvalidSession()
            }
            // A future foreground request retries; no request body or token is logged.
          }
        }
        if (current) {
          setIsReady(true)
        }
      })
      .catch(() => {
        if (current) {
          setIsSignedIn(false)
          setIsReady(true)
        }
      })
    return () => {
      current = false
    }
  }, [api, clearInvalidSession, offline, session])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const becameActive = appState.current !== "active" && nextState === "active"
      appState.current = nextState
      if (becameActive && session.isSignedIn()) {
        void flushPendingMutations(api, offline)
          .then(() => synchronizeMobileState(api, offline, { returnSession: true }))
          .catch(async (error) => {
            if (isTerminalMobileSessionFailure(error) || !session.isSignedIn()) {
              await clearInvalidSession()
            }
            // Network recovery retries in the foreground without logging tokens or request bodies.
          })
      }
    })
    return () => subscription.remove()
  }, [api, clearInvalidSession, offline, session])

  const signIn = useCallback(async () => {
    const tokens = await beginBrowserMobileLogin({ api: unauthenticatedApi, origin: MOBILE_SERVICE_ORIGIN })
    await session.setTokens(tokens)
    setIsSignedIn(true)
    try {
      await flushPendingMutations(api, offline)
      await synchronizeMobileState(api, offline)
    } catch (error) {
      if (isTerminalMobileSessionFailure(error) || !session.isSignedIn()) {
        await clearInvalidSession()
        throw new Error("This device session is no longer authorized. Sign in again.")
      }
      // The completed sign-in remains valid; the next foreground sync retries queued writes.
    }
  }, [api, clearInvalidSession, offline, session, unauthenticatedApi])

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
    () => ({ api, isReady, isSignedIn, offline, signIn, signOut }),
    [api, isReady, isSignedIn, offline, signIn, signOut]
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

export function useMobileApp() {
  const context = useContext(MobileAppContext)
  if (!context) {
    throw new Error("useMobileApp must be used inside MobileAppProvider.")
  }
  return context
}
