import type { MobileTokenResponseData } from "@arctic-rss/api-contract"

export const MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION = 2

export type StoredMobileTokens = MobileTokenResponseData & {
  accessTokenExpiresAt: number
  schemaVersion: typeof MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION
}

// Implementations must persist a complete bundle as one record. In particular,
// they must not write access and refresh tokens independently.
export type MobileTokenStore = {
  clear: () => Promise<void>
  read: () => Promise<StoredMobileTokens | null>
  write: (tokens: StoredMobileTokens) => Promise<void>
}

export type MobileTokenTransport = {
  refresh: (refreshToken: string) => Promise<MobileTokenResponseData>
}

export class MobileSessionManager {
  private persistenceQueue: Promise<void> = Promise.resolve()
  private refreshPromise: Promise<StoredMobileTokens> | null = null
  private sessionGeneration = 0
  private tokens: StoredMobileTokens | null = null

  constructor(
    private readonly store: MobileTokenStore,
    private readonly transport: MobileTokenTransport,
    private readonly options: {
      isRetryableFailure?: (error: unknown) => boolean
      now?: () => number
      refreshSkewMs?: number
    } = {}
  ) {}

  async hydrate() {
    const stored = await this.store.read()
    this.sessionGeneration += 1
    this.tokens = stored
    return this.tokens !== null
  }

  async setTokens(tokens: MobileTokenResponseData) {
    const stored = toStoredTokens(tokens, this.now())
    const generation = ++this.sessionGeneration
    await this.persistForGeneration(generation, stored)
  }

  async getAccessToken() {
    const tokens = this.tokens
    if (!tokens) {
      throw new Error("A mobile device session is required.")
    }
    if (tokens.accessTokenExpiresAt > this.now() + this.refreshSkewMs()) {
      return tokens.accessToken
    }

    return (await this.refreshSingleFlight(tokens)).accessToken
  }

  // Used only after an authenticated API request receives a 401. It shares the
  // same in-flight refresh promise as expiry-driven callers and never retries
  // the request itself; the API client permits one replay at most.
  async refreshAccessToken() {
    const tokens = this.tokens
    if (!tokens) {
      throw new Error("A mobile device session is required.")
    }
    return (await this.refreshSingleFlight(tokens)).accessToken
  }

  async clear() {
    // Clear in memory immediately, then serialize persistent deletion behind
    // any in-flight write so a completed refresh cannot restore credentials.
    this.sessionGeneration += 1
    this.tokens = null
    await this.enqueuePersistence(() => this.store.clear())
  }

  isSignedIn() {
    return this.tokens !== null
  }

  private async refreshSingleFlight(tokens: StoredMobileTokens) {
    if (!this.refreshPromise) {
      const generation = this.sessionGeneration
      const refreshToken = tokens.refreshToken
      const pending = this.refreshAndPersist(generation, refreshToken)
      this.refreshPromise = pending
      void pending.then(
        () => this.clearRefreshPromise(pending),
        () => this.clearRefreshPromise(pending)
      )
    }
    return this.refreshPromise
  }

  private async refreshAndPersist(generation: number, refreshToken: string) {
    try {
      const refreshed = await this.transport.refresh(refreshToken)
      const stored = toStoredTokens(refreshed, this.now())
      await this.persistForGeneration(generation, stored, refreshToken)
      return stored
    } catch (error) {
      if (error instanceof SessionSupersededError || this.options.isRetryableFailure?.(error)) {
        // A retryable error keeps the prior complete bundle in memory and on
        // disk. A local logout/sign-in superseding the refresh owns its state.
        throw error
      }
      try {
        await this.clear()
      } catch {
        // Credentials were still cleared in memory. Preserve the original
        // terminal-refresh result without exposing storage details.
      }
      throw error
    }
  }

  private async persistForGeneration(
    generation: number,
    tokens: StoredMobileTokens,
    expectedRefreshToken?: string
  ) {
    await this.enqueuePersistence(async () => {
      if (
        generation !== this.sessionGeneration ||
        (expectedRefreshToken !== undefined && this.tokens?.refreshToken !== expectedRefreshToken)
      ) {
        throw new SessionSupersededError()
      }
      // Store the fully validated replacement before publishing it in memory.
      // A failed write leaves the old complete bundle available for retry.
      await this.store.write(tokens)
      if (generation !== this.sessionGeneration) {
        throw new SessionSupersededError()
      }
      this.tokens = tokens
    })
  }

  private async enqueuePersistence<T>(operation: () => Promise<T>) {
    const result = this.persistenceQueue.then(operation, operation)
    this.persistenceQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private clearRefreshPromise(pending: Promise<StoredMobileTokens>) {
    if (this.refreshPromise === pending) {
      this.refreshPromise = null
    }
  }

  private now() {
    return this.options.now?.() ?? Date.now()
  }

  private refreshSkewMs() {
    return this.options.refreshSkewMs ?? 60_000
  }
}

export function toStoredTokens(tokens: MobileTokenResponseData, now: number): StoredMobileTokens {
  return {
    ...tokens,
    accessTokenExpiresAt: now + tokens.accessTokenExpiresIn * 1_000,
    schemaVersion: MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION,
  }
}

class SessionSupersededError extends Error {}
