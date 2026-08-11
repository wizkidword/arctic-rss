import {
  apiV1ErrorEnvelopeSchema,
  apiV1SuccessSchema,
  articleDetailResponseSchema,
  articleStateMutationResponseSchema,
  briefingDetailResponseSchema,
  briefingsResponseSchema,
  collectionItemMutationResponseSchema,
  collectionsResponseSchema,
  deviceInstallationResponseSchema,
  deviceSessionLogoutResponseSchema,
  meResponseSchema,
  mobileTokenResponseSchema,
  notificationPreferenceUpdateResponseSchema,
  notificationPreferencesResponseSchema,
  podcastEpisodeResponseSchema,
  podcastEpisodeStateMutationResponseSchema,
  podcastsResponseSchema,
  readerPageResponseSchema,
  savedViewsResponseSchema,
  searchPageResponseSchema,
  syncResponseSchema,
  type ArticleStateMutationRequest,
  type NotificationChannel,
  type NotificationTopic,
  type PodcastProgressMutationRequest,
  type PodcastStateMutationRequest,
  type ReaderQuery,
  type SearchQuery,
} from "@arctic-rss/api-contract"
import { z } from "zod"

export type FetchImplementation = typeof fetch

export class MobileApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number
  ) {
    super(message)
    this.name = "MobileApiError"
  }
}

export class MobileNetworkError extends Error {
  readonly retryable = true

  constructor() {
    super("Arctic RSS could not reach the service. Try again when you are online.")
    this.name = "MobileNetworkError"
  }
}

export type MobileApiClientOptions = {
  allowInsecureDevelopmentOrigin?: boolean
  fetch?: FetchImplementation
  getAccessToken?: () => Promise<string>
  origin: string
  refreshAccessToken?: () => Promise<string>
}

export type IdempotentRequest = {
  body?: Record<string, unknown>
  idempotencyKey: string
  method: "DELETE" | "PATCH" | "POST" | "PUT"
  path: string
}

export type MobileProductMilestone =
  | "first_mobile_sync"
  | "first_return_session"

export class MobileApiClient {
  private readonly fetchImplementation: FetchImplementation
  private readonly getAccessToken: (() => Promise<string>) | undefined
  private readonly origin: string
  private readonly refreshAccessToken: (() => Promise<string>) | undefined

  constructor(options: MobileApiClientOptions) {
    this.origin = normalizeMobileApiOrigin(
      options.origin,
      options.allowInsecureDevelopmentOrigin ?? false
    )
    this.fetchImplementation = options.fetch ?? fetch
    this.getAccessToken = options.getAccessToken
    this.refreshAccessToken = options.refreshAccessToken
  }

  exchangeAuthorizationCode(input: {
    clientId: string
    code: string
    codeVerifier: string
    nonce: string
    redirectUri: string
  }) {
    return this.request(
      "/api/v1/device-authorizations/exchange",
      mobileTokenResponseSchema,
      { auth: false, body: input, method: "POST" }
    )
  }

  refreshSession(refreshToken: string) {
    return this.request(
      "/api/v1/device-sessions/refresh",
      mobileTokenResponseSchema,
      { auth: false, body: { refreshToken }, method: "POST" }
    )
  }

  me() {
    return this.request("/api/v1/me", meResponseSchema)
  }

  reader(query: Partial<ReaderQuery> = {}) {
    return this.request("/api/v1/reader", readerPageResponseSchema, {
      query: query as Record<string, string | number | undefined>,
    })
  }

  article(articleId: string) {
    return this.request(`/api/v1/articles/${encodeURIComponent(articleId)}`, articleDetailResponseSchema)
  }

  search(query: Partial<SearchQuery>) {
    return this.request("/api/v1/search", searchPageResponseSchema, {
      query: query as Record<string, string | number | undefined>,
    })
  }

  savedViews() {
    return this.request("/api/v1/saved-views", savedViewsResponseSchema, { query: { limit: 50 } })
  }

  collections() {
    return this.request("/api/v1/collections", collectionsResponseSchema)
  }

  podcasts() {
    return this.request("/api/v1/podcasts", podcastsResponseSchema, { query: { limit: 50 } })
  }

  podcastEpisode(episodeId: string) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}`,
      podcastEpisodeResponseSchema
    )
  }

  briefings() {
    return this.request("/api/v1/briefings", briefingsResponseSchema, { query: { limit: 50 } })
  }

  briefing(briefingId: string) {
    return this.request(
      `/api/v1/briefings/${encodeURIComponent(briefingId)}`,
      briefingDetailResponseSchema
    )
  }

  notificationPreferences() {
    return this.request("/api/v1/notification-preferences", notificationPreferencesResponseSchema)
  }

  updateNotificationPreference(
    topic: NotificationTopic,
    channel: NotificationChannel,
    idempotencyKey: string
  ) {
    return this.request(
      `/api/v1/notification-preferences/${encodeURIComponent(topic)}`,
      notificationPreferenceUpdateResponseSchema,
      { body: { channel }, idempotencyKey, method: "PUT" }
    )
  }

  updateArticleState(
    articleId: string,
    input: ArticleStateMutationRequest,
    idempotencyKey: string
  ) {
    return this.request(
      `/api/v1/articles/${encodeURIComponent(articleId)}/state`,
      articleStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH" }
    )
  }

  addCollectionItem(collectionId: string, articleId: string, idempotencyKey: string) {
    return this.request(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/items`,
      collectionItemMutationResponseSchema,
      { body: { articleId }, idempotencyKey, method: "POST" }
    )
  }

  removeCollectionItem(collectionId: string, articleId: string, idempotencyKey: string) {
    return this.request(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(articleId)}`,
      collectionItemMutationResponseSchema,
      { idempotencyKey, method: "DELETE" }
    )
  }

  updatePodcastProgress(
    episodeId: string,
    input: PodcastProgressMutationRequest,
    idempotencyKey: string
  ) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}/progress`,
      podcastEpisodeStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH" }
    )
  }

  updatePodcastState(
    episodeId: string,
    input: PodcastStateMutationRequest,
    idempotencyKey: string
  ) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}/state`,
      podcastEpisodeStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH" }
    )
  }

  registerInstallation(
    input: { environment: "development" | "preview" | "production"; pushToken: string },
    idempotencyKey: string
  ) {
    return this.request("/api/v1/device-installations/current", deviceInstallationResponseSchema, {
      body: input,
      idempotencyKey,
      method: "PUT",
    })
  }

  unregisterInstallation(pushToken: string, idempotencyKey: string) {
    return this.request("/api/v1/device-installations/current", deviceInstallationResponseSchema, {
      body: { pushToken },
      idempotencyKey,
      method: "DELETE",
    })
  }

  sync(cursor?: string) {
    return this.request("/api/v1/sync", syncResponseSchema, {
      query: { cursor, limit: 100 },
    })
  }

  logout() {
    return this.request("/api/v1/device-sessions/current/logout", deviceSessionLogoutResponseSchema, {
      method: "POST",
    })
  }

  replayMutation(request: IdempotentRequest) {
    assertQueuedMutation(request)
    return this.request(request.path, apiV1SuccessSchema(z.unknown()), {
      body: request.body,
      idempotencyKey: request.idempotencyKey,
      method: request.method,
    })
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      auth?: boolean
      body?: unknown
      headers?: Record<string, string>
      idempotencyKey?: string
      method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
      query?: Record<string, string | number | undefined>
    } = {}
  ): Promise<T> {
    const method = options.method ?? "GET"
    const headers = new Headers({ Accept: "application/json" })
    Object.entries(options.headers ?? {}).forEach(([name, value]) => {
      headers.set(name, value)
    })
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json")
    }
    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey)
    }
    const requiresAuthentication = options.auth !== false
    if (requiresAuthentication) {
      if (!this.getAccessToken) {
        throw new MobileApiError(
          "MOBILE_DEVICE_SESSION_REQUIRED",
          "Sign in to Arctic RSS before continuing.",
          false,
          401
        )
      }
      headers.set("Authorization", `Bearer ${await this.getAccessToken()}`)
    }

    const url = buildMobileApiUrl(this.origin, path, options.query)
    let response: Response
    try {
      response = await this.fetchImplementation(url, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method,
      })
    } catch {
      throw new MobileNetworkError()
    }

    if (requiresAuthentication && response.status === 401 && this.refreshAccessToken) {
      // A refresh is coordinated by MobileSessionManager. Replay exactly once
      // with the persisted replacement token; do not recurse on another 401.
      headers.set("Authorization", `Bearer ${await this.refreshAccessToken()}`)
      try {
        response = await this.fetchImplementation(url, {
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          headers,
          method,
        })
      } catch {
        throw new MobileNetworkError()
      }
    }

    const body = await readJson(response)
    if (!response.ok) {
      const parsed = apiV1ErrorEnvelopeSchema.safeParse(body)
      if (parsed.success) {
        throw new MobileApiError(
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.retryable,
          response.status
        )
      }
      throw new MobileApiError(
        "INTERNAL_ERROR",
        "Arctic RSS could not complete this request.",
        response.status >= 500,
        response.status
      )
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new MobileApiError(
        "INTERNAL_ERROR",
        "Arctic RSS returned an invalid response.",
        true,
        response.status
      )
    }
    return parsed.data
  }
}

export function normalizeMobileApiOrigin(origin: string, allowInsecureDevelopmentOrigin = false) {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new Error("The Arctic RSS service URL is invalid.")
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The Arctic RSS service URL must be an origin without credentials or a path.")
  }
  if (url.protocol !== "https:" && !(allowInsecureDevelopmentOrigin && url.protocol === "http:")) {
    throw new Error("Arctic RSS requires HTTPS outside explicit development builds.")
  }
  return url.origin
}

export function buildMobileApiUrl(
  origin: string,
  path: string,
  query?: Record<string, string | number | undefined>
) {
  if (!path.startsWith("/api/v1/") && path !== "/api/mobile/authorize") {
    throw new Error("Mobile requests must use the reviewed Arctic RSS API routes.")
  }
  const url = new URL(path, `${origin}/`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export function assertQueuedMutation(request: IdempotentRequest) {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(request.idempotencyKey)) {
    throw new Error("Queued mobile mutations require a bounded idempotency key.")
  }
  const validPath = [
    /^\/api\/v1\/articles\/[A-Za-z0-9_-]+\/state$/,
    /^\/api\/v1\/collections\/[A-Za-z0-9_-]+\/items(?:\/[A-Za-z0-9_-]+)?$/,
    /^\/api\/v1\/podcast-episodes\/[A-Za-z0-9_-]+\/(?:progress|state)$/,
    /^\/api\/v1\/notification-preferences\/(?:SECURITY_ALERTS|SAVED_MONITOR_MATCHES|SMART_DIGEST_COMPLETION|CHAT_MENTIONS)$/,
  ].some((pattern) => pattern.test(request.path))
  if (!validPath || JSON.stringify(request.body ?? {}).length > 8_192) {
    throw new Error("Queued mobile mutation is outside the bounded v1 offline scope.")
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}
