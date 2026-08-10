import type { MobileTokenResponseData } from "@arctic-rss/api-contract"

export type StoredMobileTokens = MobileTokenResponseData & {
  accessTokenExpiresAt: number
}

export type MobileTokenStore = {
  clear: () => Promise<void>
  read: () => Promise<StoredMobileTokens | null>
  write: (tokens: StoredMobileTokens) => Promise<void>
}

export type MobileTokenTransport = {
  refresh: (refreshToken: string) => Promise<MobileTokenResponseData>
}

export class MobileSessionManager {
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
    this.tokens = await this.store.read()
    return this.tokens !== null
  }

  async setTokens(tokens: MobileTokenResponseData) {
    const stored = toStoredTokens(tokens, this.now())
    this.tokens = stored
    await this.store.write(stored)
  }

  async getAccessToken() {
    if (!this.tokens) {
      throw new Error("A mobile device session is required.")
    }
    if (this.tokens.accessTokenExpiresAt > this.now() + this.refreshSkewMs()) {
      return this.tokens.accessToken
    }

    try {
      const refreshed = await this.transport.refresh(this.tokens.refreshToken)
      await this.setTokens(refreshed)
      return this.tokens!.accessToken
    } catch (error) {
      if (!this.options.isRetryableFailure?.(error)) {
        await this.clear()
      }
      throw error
    }
  }

  async clear() {
    this.tokens = null
    await this.store.clear()
  }

  isSignedIn() {
    return this.tokens !== null
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
  }
}
