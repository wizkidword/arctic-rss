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
  syncBootstrapResponseSchema,
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

export const DEFAULT_MOBILE_READ_DEADLINE_MS = 15_000
export const DEFAULT_MOBILE_WRITE_DEADLINE_MS = 20_000
export const DEFAULT_MOBILE_RESPONSE_BYTES = 512 * 1024

export type MobileRequestOptions = {
  signal?: AbortSignal
}

export class MobileApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number,
    readonly retryAfterMs: number | null = null
  ) {
    super(message)
    this.name = "MobileApiError"
  }
}

export class MobileNetworkError extends Error {
  readonly retryable: boolean

  constructor(
    readonly code:
      | "MOBILE_NETWORK_UNAVAILABLE"
      | "MOBILE_REQUEST_ABORTED"
      | "MOBILE_REQUEST_DEADLINE_EXCEEDED" = "MOBILE_NETWORK_UNAVAILABLE"
  ) {
    super(
      code === "MOBILE_REQUEST_ABORTED"
        ? "Arctic RSS stopped an obsolete request."
        : code === "MOBILE_REQUEST_DEADLINE_EXCEEDED"
          ? "Arctic RSS took too long to respond. Try again when you are online."
          : "Arctic RSS could not reach the service. Try again when you are online."
    )
    this.name = "MobileNetworkError"
    this.retryable = code !== "MOBILE_REQUEST_ABORTED"
  }
}

export type MobileApiClientOptions = {
  allowInsecureDevelopmentOrigin?: boolean
  fetch?: FetchImplementation
  getAccessToken?: () => Promise<string>
  maximumResponseBytes?: number
  origin: string
  readDeadlineMs?: number
  refreshAccessToken?: () => Promise<string>
  writeDeadlineMs?: number
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
  private readonly maximumResponseBytes: number
  private readonly origin: string
  private readonly readDeadlineMs: number
  private readonly refreshAccessToken: (() => Promise<string>) | undefined
  private readonly writeDeadlineMs: number

  constructor(options: MobileApiClientOptions) {
    this.origin = normalizeMobileApiOrigin(
      options.origin,
      options.allowInsecureDevelopmentOrigin ?? false
    )
    this.fetchImplementation = options.fetch ?? fetch
    this.getAccessToken = options.getAccessToken
    this.maximumResponseBytes = boundedPositiveInteger(
      options.maximumResponseBytes,
      DEFAULT_MOBILE_RESPONSE_BYTES,
      1_024,
      2 * 1024 * 1024
    )
    this.readDeadlineMs = boundedPositiveInteger(
      options.readDeadlineMs,
      DEFAULT_MOBILE_READ_DEADLINE_MS,
      1_000,
      60_000
    )
    this.refreshAccessToken = options.refreshAccessToken
    this.writeDeadlineMs = boundedPositiveInteger(
      options.writeDeadlineMs,
      DEFAULT_MOBILE_WRITE_DEADLINE_MS,
      1_000,
      60_000
    )
  }

  exchangeAuthorizationCode(input: {
    clientId: string
    code: string
    codeVerifier: string
    nonce: string
    redirectUri: string
  }, requestOptions: MobileRequestOptions = {}) {
    return this.request(
      "/api/v1/device-authorizations/exchange",
      mobileTokenResponseSchema,
      { auth: false, body: input, method: "POST", ...requestOptions }
    )
  }

  refreshSession(refreshToken: string, requestOptions: MobileRequestOptions = {}) {
    return this.request(
      "/api/v1/device-sessions/refresh",
      mobileTokenResponseSchema,
      { auth: false, body: { refreshToken }, method: "POST", ...requestOptions }
    )
  }

  me(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/me", meResponseSchema, requestOptions)
  }

  reader(query: Partial<ReaderQuery> = {}, requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/reader", readerPageResponseSchema, {
      query: query as Record<string, string | number | undefined>,
      ...requestOptions,
    })
  }

  article(articleId: string, requestOptions: MobileRequestOptions = {}) {
    return this.request(
      `/api/v1/articles/${encodeURIComponent(articleId)}`,
      articleDetailResponseSchema,
      requestOptions
    )
  }

  search(query: Partial<SearchQuery>, requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/search", searchPageResponseSchema, {
      query: query as Record<string, string | number | undefined>,
      ...requestOptions,
    })
  }

  savedViews(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/saved-views", savedViewsResponseSchema, {
      query: { limit: 50 },
      ...requestOptions,
    })
  }

  collections(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/collections", collectionsResponseSchema, requestOptions)
  }

  podcasts(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/podcasts", podcastsResponseSchema, {
      query: { limit: 50 },
      ...requestOptions,
    })
  }

  podcastEpisode(episodeId: string, requestOptions: MobileRequestOptions = {}) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}`,
      podcastEpisodeResponseSchema,
      requestOptions
    )
  }

  briefings(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/briefings", briefingsResponseSchema, {
      query: { limit: 50 },
      ...requestOptions,
    })
  }

  briefing(briefingId: string, requestOptions: MobileRequestOptions = {}) {
    return this.request(
      `/api/v1/briefings/${encodeURIComponent(briefingId)}`,
      briefingDetailResponseSchema,
      requestOptions
    )
  }

  notificationPreferences(requestOptions: MobileRequestOptions = {}) {
    return this.request(
      "/api/v1/notification-preferences",
      notificationPreferencesResponseSchema,
      requestOptions
    )
  }

  updateNotificationPreference(
    topic: NotificationTopic,
    channel: NotificationChannel,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/notification-preferences/${encodeURIComponent(topic)}`,
      notificationPreferenceUpdateResponseSchema,
      { body: { channel }, idempotencyKey, method: "PUT", ...requestOptions }
    )
  }

  updateArticleState(
    articleId: string,
    input: ArticleStateMutationRequest,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/articles/${encodeURIComponent(articleId)}/state`,
      articleStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH", ...requestOptions }
    )
  }

  addCollectionItem(
    collectionId: string,
    articleId: string,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/items`,
      collectionItemMutationResponseSchema,
      { body: { articleId }, idempotencyKey, method: "POST", ...requestOptions }
    )
  }

  removeCollectionItem(
    collectionId: string,
    articleId: string,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(articleId)}`,
      collectionItemMutationResponseSchema,
      { idempotencyKey, method: "DELETE", ...requestOptions }
    )
  }

  updatePodcastProgress(
    episodeId: string,
    input: PodcastProgressMutationRequest,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}/progress`,
      podcastEpisodeStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH", ...requestOptions }
    )
  }

  updatePodcastState(
    episodeId: string,
    input: PodcastStateMutationRequest,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request(
      `/api/v1/podcast-episodes/${encodeURIComponent(episodeId)}/state`,
      podcastEpisodeStateMutationResponseSchema,
      { body: input, idempotencyKey, method: "PATCH", ...requestOptions }
    )
  }

  registerInstallation(
    input: { environment: "development" | "preview" | "production"; pushToken: string },
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request("/api/v1/device-installations/current", deviceInstallationResponseSchema, {
      body: input,
      idempotencyKey,
      method: "PUT",
      ...requestOptions,
    })
  }

  unregisterInstallation(
    pushToken: string,
    idempotencyKey: string,
    requestOptions: MobileRequestOptions = {}
  ) {
    return this.request("/api/v1/device-installations/current", deviceInstallationResponseSchema, {
      body: { pushToken },
      idempotencyKey,
      method: "DELETE",
      ...requestOptions,
    })
  }

  sync(cursor?: string, requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/sync", syncResponseSchema, {
      query: { cursor, limit: 100 },
      ...requestOptions,
    })
  }

  syncBootstrap(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/sync/bootstrap", syncBootstrapResponseSchema, requestOptions)
  }

  logout(requestOptions: MobileRequestOptions = {}) {
    return this.request("/api/v1/device-sessions/current/logout", deviceSessionLogoutResponseSchema, {
      method: "POST",
      ...requestOptions,
    })
  }

  replayMutation(request: IdempotentRequest, requestOptions: MobileRequestOptions = {}) {
    assertQueuedMutation(request)
    return this.request(request.path, apiV1SuccessSchema(z.unknown()), {
      body: request.body,
      idempotencyKey: request.idempotencyKey,
      method: request.method,
      ...requestOptions,
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
      signal?: AbortSignal
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
    const requestBoundary = createMobileRequestBoundary({
      deadlineMs: method === "GET" ? this.readDeadlineMs : this.writeDeadlineMs,
      signal: options.signal,
    })
    try {
      if (requiresAuthentication) {
        if (!this.getAccessToken) {
          throw new MobileApiError(
            "MOBILE_DEVICE_SESSION_REQUIRED",
            "Sign in to Arctic RSS before continuing.",
            false,
            401
          )
        }
        headers.set(
          "Authorization",
          `Bearer ${await awaitWithinMobileRequestBoundary(this.getAccessToken(), requestBoundary)}`
        )
      }

      const url = buildMobileApiUrl(this.origin, path, options.query)
      let response = await this.fetchWithBoundary({
        body: options.body,
        headers,
        method,
        requestBoundary,
        url,
      })

      if (
        requiresAuthentication &&
        response.status === 401 &&
        this.refreshAccessToken &&
        (method === "GET" || Boolean(options.idempotencyKey))
      ) {
        // A refresh is coordinated by MobileSessionManager. Replay exactly once
        // with the persisted replacement token; do not recurse on another 401.
        headers.set(
          "Authorization",
          `Bearer ${await awaitWithinMobileRequestBoundary(this.refreshAccessToken(), requestBoundary)}`
        )
        response = await this.fetchWithBoundary({
          body: options.body,
          headers,
          method,
          requestBoundary,
          url,
        })
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"))
      const body = await readBoundedJson(response, this.maximumResponseBytes)
      if (!response.ok) {
        const parsed = apiV1ErrorEnvelopeSchema.safeParse(body)
        if (parsed.success) {
          throw new MobileApiError(
            parsed.data.error.code,
            parsed.data.error.message,
            parsed.data.error.retryable || response.status === 429 || response.status === 503,
            response.status,
            retryAfterMs
          )
        }
        throw new MobileApiError(
          "INTERNAL_ERROR",
          "Arctic RSS could not complete this request.",
          response.status >= 500 || response.status === 429 || response.status === 503,
          response.status,
          retryAfterMs
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
    } catch (error) {
      if (error instanceof MobileApiError || error instanceof MobileNetworkError) {
        throw error
      }
      if (error instanceof MobileResponseTooLargeError) {
        throw new MobileApiError(
          "MOBILE_RESPONSE_TOO_LARGE",
          "Arctic RSS returned an invalid response.",
          true,
          502
        )
      }
      throw requestBoundary.networkError()
    } finally {
      requestBoundary.close()
    }
  }

  private async fetchWithBoundary({
    body,
    headers,
    method,
    requestBoundary,
    url,
  }: {
    body: unknown
    headers: Headers
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
    requestBoundary: MobileRequestBoundary
    url: string
  }) {
    if (requestBoundary.signal.aborted) {
      throw requestBoundary.networkError()
    }
    try {
      return await this.fetchImplementation(url, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers,
        method,
        signal: requestBoundary.signal,
      })
    } catch {
      throw requestBoundary.networkError()
    }
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

type MobileRequestBoundary = {
  close: () => void
  networkError: () => MobileNetworkError
  signal: AbortSignal
}

class MobileResponseTooLargeError extends Error {
  constructor() {
    super("Mobile response exceeds the configured byte limit.")
  }
}

function createMobileRequestBoundary({
  deadlineMs,
  signal,
}: {
  deadlineMs: number
  signal?: AbortSignal
}): MobileRequestBoundary {
  const controller = new AbortController()
  let abortedByCaller = false
  let timedOut = false
  const abortForCaller = () => {
    abortedByCaller = true
    controller.abort()
  }
  if (signal?.aborted) {
    abortForCaller()
  } else {
    signal?.addEventListener("abort", abortForCaller, { once: true })
  }
  const deadline = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, deadlineMs)

  return {
    close: () => {
      clearTimeout(deadline)
      signal?.removeEventListener("abort", abortForCaller)
    },
    networkError: () =>
      new MobileNetworkError(
        abortedByCaller
          ? "MOBILE_REQUEST_ABORTED"
          : timedOut
            ? "MOBILE_REQUEST_DEADLINE_EXCEEDED"
            : "MOBILE_NETWORK_UNAVAILABLE"
      ),
    signal: controller.signal,
  }
}

function awaitWithinMobileRequestBoundary<T>(
  operation: Promise<T>,
  requestBoundary: MobileRequestBoundary
): Promise<T> {
  if (requestBoundary.signal.aborted) {
    return Promise.reject(requestBoundary.networkError())
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      cleanup()
      reject(requestBoundary.networkError())
    }
    const cleanup = () => requestBoundary.signal.removeEventListener("abort", abort)
    requestBoundary.signal.addEventListener("abort", abort, { once: true })
    void operation.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      }
    )
  })
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function parseRetryAfterMs(value: string | null, now = Date.now()) {
  if (!value) {
    return null
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000)
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new MobileResponseTooLargeError()
  }
  const reader = response.body?.getReader()
  if (reader) {
    const chunks: Uint8Array[] = []
    let byteLength = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (!value) {
          continue
        }
        byteLength += value.byteLength
        if (byteLength > maximumBytes) {
          await reader.cancel()
          throw new MobileResponseTooLargeError()
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const payload = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      payload.set(chunk, offset)
      offset += chunk.byteLength
    }
    return parseJson(new TextDecoder().decode(payload))
  }

  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new MobileResponseTooLargeError()
  }
  return parseJson(text)
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
