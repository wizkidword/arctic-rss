import dns from "node:dns/promises"
import net from "node:net"
import type { LookupFunction } from "node:net"
import { Agent, fetch as undiciFetch } from "undici"

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_TOTAL_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 5
const MAX_CONCURRENT_REQUESTS_PER_HOST = 4
const USER_AGENT = "ArcticRSS/0.1 (+https://arcticrss.com)"
const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5"

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeUrlError"
  }
}

export class FeedFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedFetchError"
  }
}

export type SafeFetchTextResult = {
  bytes?: number
  contentType: string
  etag?: string
  lastModified?: string
  notModified?: boolean
  status?: number
  text: string
  url: URL
}

export type SafeFetchBytesResult = {
  bytes: Uint8Array
  contentType: string
  etag?: string
  lastModified?: string
  notModified: boolean
  status: number
  url: URL
}

type SafeFetchOptions = {
  // This is an internal test seam. Production calls use the pinned Undici transport.
  fetchImpl?: typeof fetch
  lookup?: typeof dns.lookup
  maxBytes?: number
  timeoutMs?: number
  totalTimeoutMs?: number
  hostRequestLimiter?: HostRequestLimiter
  ifModifiedSince?: string
  ifNoneMatch?: string
  allowNotModified?: boolean
  now?: () => number
  accept?: string
  userAgent?: string
}

export type SafeFetchTextOptions = SafeFetchOptions
export type SafeFetchBytesOptions = SafeFetchOptions

export type PublicAddress = {
  address: string
  family: 4 | 6
}

export type HostRequestLimiter = {
  acquire: (hostname: string, signal?: AbortSignal) => Promise<() => void>
}

type HostRequestState = {
  active: number
  waiters: Array<() => void>
}

type PinnedFetchResponse = {
  response: FetchResponse
  dispose: () => Promise<void>
}

type FetchResponse = {
  arrayBuffer: () => Promise<ArrayBuffer>
  body: ReadableStream<Uint8Array> | null
  bodyUsed: boolean
  headers: {
    get: (name: string) => string | null
  }
  ok: boolean
  status: number
  text: () => Promise<string>
}

const sharedHostRequestLimiter = createHostRequestLimiter()

export function normalizeHttpUrl(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new UnsafeUrlError("Enter a feed or website URL.")
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  let url: URL

  try {
    url = new URL(withProtocol)
  } catch {
    throw new UnsafeUrlError("Enter a valid URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs are supported.")
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.")
  }

  if (
    url.port &&
    !(
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    )
  ) {
    throw new UnsafeUrlError("Only standard HTTP and HTTPS ports are allowed.")
  }

  url.hash = ""
  assertPublicHostname(url.hostname)

  return url
}

function assertPublicHostname(hostname: string) {
  const normalized = normalizeHostname(hostname)
  const ipVersion = net.isIP(normalized)

  if (ipVersion && isPrivateIpAddress(normalized)) {
    throw new UnsafeUrlError("Local and internal hostnames are not allowed.")
  }

  if (ipVersion) {
    return
  }

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    !normalized.includes(".")
  ) {
    throw new UnsafeUrlError("Local and internal hostnames are not allowed.")
  }
}

export function isPrivateIpAddress(address: string) {
  const normalized = normalizeHostname(address)
  const ipVersion = net.isIP(normalized)

  if (ipVersion === 4) {
    return isPrivateIpv4Address(normalized)
  }

  if (ipVersion === 6) {
    return isPrivateIpv6Address(normalized)
  }

  // DNS results must be literal IP addresses. Treat malformed values as unsafe.
  return true
}

function isPrivateIpv4Address(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10))
  const [first, second, third] = parts

  if (
    parts.length !== 4 ||
    parts.some(
      (part) => !Number.isInteger(part) || part < 0 || part > 255
    )
  ) {
    return true
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  )
}

function isPrivateIpv6Address(address: string) {
  const groups = parseIpv6Hextets(address)

  if (!groups) {
    return true
  }

  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = groups
  const firstSixGroupsAreZero = groups.slice(0, 6).every((group) => group === 0)

  if (
    groups.every((group) => group === 0) ||
    (groups.slice(0, 7).every((group) => group === 0) && eighth === 1) ||
    firstSixGroupsAreZero
  ) {
    return true
  }

  // IPv4-mapped IPv6 can otherwise turn an internal IPv4 address into a
  // hexadecimal IPv6 literal (for example, ::ffff:a9fe:a9fe).
  if (groups.slice(0, 5).every((group) => group === 0) && sixth === 0xffff) {
    return isPrivateIpv4Address(
      [seventh >> 8, seventh & 0xff, eighth >> 8, eighth & 0xff].join(".")
    )
  }

  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0010) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0020) ||
    first === 0x2002 ||
    (first === 0x64 && second === 0xff9b && third === 0 && fourth === 0 && fifth === 0 && sixth === 0) ||
    (first === 0x64 && second === 0xff9b && third === 1) ||
    (first === 0x100 && second === 0 && third === 0 && fourth === 0)
  )
}

export async function assertUrlResolvesPublicly(
  url: URL,
  lookup: typeof dns.lookup = dns.lookup
): Promise<PublicAddress> {
  const hostname = normalizeHostname(url.hostname)

  assertPublicHostname(hostname)

  const directIpFamily = net.isIP(hostname)

  if (directIpFamily === 4 || directIpFamily === 6) {
    return {
      address: hostname,
      family: directIpFamily,
    }
  }

  let addresses: Array<{ address: string; family?: number }>

  try {
    addresses = (await lookup(hostname, {
      all: true,
      verbatim: true,
    })) as Array<{ address: string; family?: number }>
  } catch {
    throw new UnsafeUrlError("The URL hostname could not be resolved.")
  }

  if (!addresses.length) {
    throw new UnsafeUrlError("The URL hostname could not be resolved.")
  }

  const publicAddresses: PublicAddress[] = []

  for (const result of addresses) {
    const family = net.isIP(result.address)

    if ((family !== 4 && family !== 6) || isPrivateIpAddress(result.address)) {
      throw new UnsafeUrlError("Local and internal hostnames are not allowed.")
    }

    publicAddresses.push({
      address: result.address,
      family,
    })
  }

  // Every returned address must be public, then the selected address is passed
  // directly to the connection. This closes the DNS rebinding window.
  return publicAddresses[0]
}

export async function safeFetchText(
  inputUrl: URL,
  options: SafeFetchTextOptions = {}
): Promise<SafeFetchTextResult> {
  const result = await safeFetchBytes(inputUrl, options)

  return {
    bytes: result.bytes.byteLength,
    contentType: result.contentType,
    etag: result.etag,
    lastModified: result.lastModified,
    notModified: result.notModified,
    status: result.status,
    text: new TextDecoder().decode(result.bytes),
    url: result.url,
  }
}

export async function safeFetchBytes(
  inputUrl: URL,
  options: SafeFetchBytesOptions = {}
): Promise<SafeFetchBytesResult> {
  const lookup = options.lookup ?? dns.lookup
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS
  const hostRequestLimiter = options.hostRequestLimiter ?? sharedHostRequestLimiter
  const now = options.now ?? Date.now
  const deadline = now() + totalTimeoutMs
  let url = inputUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const remainingMs = Math.min(timeoutMs, deadline - now())

    if (remainingMs <= 0) {
      throw new FeedFetchError("The URL request timed out.")
    }

    const signal = AbortSignal.timeout(Math.max(1, Math.floor(remainingMs)))
    let releaseSlot: (() => void) | undefined
    let dispose: () => Promise<void> = async () => undefined

    try {
      const address = await awaitWithSignal(
        assertUrlResolvesPublicly(url, lookup),
        signal
      )
      releaseSlot = await hostRequestLimiter.acquire(normalizeHostname(url.hostname), signal)

      const request = options.fetchImpl
        ? {
            response: await options.fetchImpl(url, createFetchOptions(signal, options)),
            dispose,
          }
        : await fetchWithPinnedAddress(
            url,
            address,
            signal,
            remainingMs,
            maxBytes,
            options
          )

      dispose = request.dispose
      const { response } = request

      if (response.status === 304 && options.allowNotModified) {
        return responseResult({
          bytes: new Uint8Array(),
          notModified: true,
          response,
          url,
        })
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")

        if (!location) {
          throw new FeedFetchError("The URL redirected without a Location header.")
        }

        url = normalizeHttpUrl(new URL(location, url).href)
        continue
      }

      if (!response.ok) {
        throw new FeedFetchError(`The URL returned HTTP ${response.status}.`)
      }

      return responseResult({
        bytes: await readResponseBytes(response, maxBytes),
        notModified: false,
        response,
        url,
      })
    } catch (error) {
      if (isResponseTooLargeError(error)) {
        throw new FeedFetchError("The response is too large to inspect safely.")
      }

      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === "TimeoutError")
      ) {
        throw new FeedFetchError("The URL request timed out.")
      }

      throw error
    } finally {
      await dispose()
      releaseSlot?.()
    }
  }

  throw new FeedFetchError("The URL redirected too many times.")
}

export function createHostRequestLimiter(
  maxConcurrentRequests = MAX_CONCURRENT_REQUESTS_PER_HOST
): HostRequestLimiter {
  if (!Number.isInteger(maxConcurrentRequests) || maxConcurrentRequests < 1) {
    throw new RangeError("maxConcurrentRequests must be a positive integer.")
  }

  const hosts = new Map<string, HostRequestState>()

  return {
    acquire(hostname, signal) {
      const host = normalizeHostname(hostname)
      const state = hosts.get(host) ?? { active: 0, waiters: [] }
      hosts.set(host, state)

      if (signal?.aborted) {
        return Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))
      }

      if (state.active < maxConcurrentRequests) {
        state.active += 1
        return Promise.resolve(createRelease(state, host, hosts))
      }

      return new Promise((resolve, reject) => {
        const onAbort = () => {
          const waiterIndex = state.waiters.indexOf(grantSlot)

          if (waiterIndex >= 0) {
            state.waiters.splice(waiterIndex, 1)
          }

          if (state.active === 0 && state.waiters.length === 0) {
            hosts.delete(host)
          }

          reject(new DOMException("The operation timed out.", "TimeoutError"))
        }

        const grantSlot = () => {
          signal?.removeEventListener("abort", onAbort)
          state.active += 1
          resolve(createRelease(state, host, hosts))
        }

        state.waiters.push(grantSlot)
        signal?.addEventListener("abort", onAbort, { once: true })
      })
    },
  }
}

function createRelease(
  state: HostRequestState,
  host: string,
  hosts: Map<string, HostRequestState>
) {
  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    state.active -= 1
    const next = state.waiters.shift()

    if (next) {
      next()
    } else if (state.active === 0) {
      hosts.delete(host)
    }
  }
}

function createFetchOptions(
  signal: AbortSignal,
  options: Pick<
    SafeFetchOptions,
    "accept" | "ifModifiedSince" | "ifNoneMatch" | "userAgent"
  >
): RequestInit {
  return {
    headers: requestHeaders(options),
    redirect: "manual",
    signal,
  }
}

function awaitWithSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("The operation timed out.", "TimeoutError"))
    }

    signal.addEventListener("abort", onAbort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
  })
}

async function fetchWithPinnedAddress(
  url: URL,
  address: PublicAddress,
  signal: AbortSignal,
  timeoutMs: number,
  maxBytes: number,
  options: Pick<
    SafeFetchOptions,
    "accept" | "ifModifiedSince" | "ifNoneMatch" | "userAgent"
  >
): Promise<PinnedFetchResponse> {
  const dispatcher = new Agent({
    bodyTimeout: timeoutMs,
    connectTimeout: timeoutMs,
    connections: 1,
    headersTimeout: timeoutMs,
    maxResponseSize: maxBytes,
    pipelining: 0,
    connect: {
      lookup: createPinnedLookup(address),
      ...(net.isIP(normalizeHostname(url.hostname))
        ? {}
        : { servername: normalizeHostname(url.hostname) }),
    },
  })

  let response: FetchResponse | undefined

  try {
    const fetchedResponse = (await undiciFetch(url, {
      dispatcher,
      headers: requestHeaders(options),
      redirect: "manual",
      signal,
    })) as unknown as FetchResponse
    response = fetchedResponse

    return {
      response: fetchedResponse,
      dispose: async () => {
        if (response?.body && !response.bodyUsed) {
          await response.body.cancel().catch(() => undefined)
        }

        await dispatcher.destroy().catch(() => undefined)
      },
    }
  } catch (error) {
    await dispatcher.destroy().catch(() => undefined)
    throw error
  }
}

function requestHeaders(
  options: Pick<
    SafeFetchOptions,
    "accept" | "ifModifiedSince" | "ifNoneMatch" | "userAgent"
  >
) {
  const headers: Record<string, string> = {
    accept: options.accept ?? ACCEPT_HEADER,
    "user-agent": options.userAgent ?? USER_AGENT,
  }
  const ifNoneMatch = safeHeaderValue(options.ifNoneMatch)
  const ifModifiedSince = safeHeaderValue(options.ifModifiedSince)

  if (ifNoneMatch) {
    headers["if-none-match"] = ifNoneMatch
  }

  if (ifModifiedSince) {
    headers["if-modified-since"] = ifModifiedSince
  }

  return headers
}

function responseResult({
  bytes,
  notModified,
  response,
  url,
}: {
  bytes: Uint8Array
  notModified: boolean
  response: FetchResponse
  url: URL
}): SafeFetchBytesResult {
  return {
    bytes,
    contentType: response.headers.get("content-type") ?? "",
    etag: safeHeaderValue(response.headers.get("etag")),
    lastModified: safeHeaderValue(response.headers.get("last-modified")),
    notModified,
    status: response.status,
    url,
  }
}

function safeHeaderValue(value: string | null | undefined) {
  if (!value || value.length > 512 || /[\r\n]/.test(value)) {
    return undefined
  }

  return value
}

export function createPinnedLookup(address: PublicAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address])
      return
    }

    callback(null, address.address, address.family)
  }
}

function isResponseTooLargeError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "ResponseExceededMaxSizeError" ||
      ("code" in error && error.code === "UND_ERR_RES_EXCEEDED_MAX_SIZE"))
  )
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
}

function parseIpv6Hextets(address: string) {
  const normalized = normalizeHostname(address)
  const sections = normalized.split("::")

  if (sections.length > 2) {
    return null
  }

  const left = sections[0] ? sections[0].split(":") : []
  const right = sections.length === 2 && sections[1] ? sections[1].split(":") : []
  const parts = [...left, ...right]
  const dottedIpv4 = parts.findIndex((part) => part.includes("."))

  if (dottedIpv4 >= 0) {
    if (dottedIpv4 !== parts.length - 1 || !net.isIP(parts[dottedIpv4])) {
      return null
    }

    const ipv4Parts = parts.pop()!.split(".").map(Number)
    parts.push(
      ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16),
      ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16)
    )
  }

  if (sections.length === 1) {
    if (parts.length !== 8) {
      return null
    }
  } else {
    const missing = 8 - parts.length

    if (missing < 1) {
      return null
    }

    parts.splice(left.length, 0, ...Array.from({ length: missing }, () => "0"))
  }

  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
    return null
  }

  return parts.map((part) => Number.parseInt(part, 16))
}

async function readResponseBytes(response: FetchResponse, maxBytes: number) {
  const contentLength = response.headers.get("content-length")

  if (contentLength && Number(contentLength) > maxBytes) {
    throw new FeedFetchError("The response is too large to inspect safely.")
  }

  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer())
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    received += value.byteLength

    if (received > maxBytes) {
      reader.cancel().catch(() => undefined)
      throw new FeedFetchError("The response is too large to inspect safely.")
    }

    chunks.push(value)
  }

  return new Uint8Array(Buffer.concat(chunks, received))
}
