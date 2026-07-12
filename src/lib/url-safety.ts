import dns from "node:dns/promises"
import net from "node:net"

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 5

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
  contentType: string
  text: string
  url: URL
}

export type SafeFetchTextOptions = {
  fetchImpl?: typeof fetch
  lookup?: typeof dns.lookup
  maxBytes?: number
  timeoutMs?: number
}

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
  const normalized = hostname.toLowerCase().replace(/\.$/, "")
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
  const ipVersion = net.isIP(address)

  if (ipVersion === 4) {
    return isPrivateIpv4Address(address)
  }

  if (ipVersion === 6) {
    return isPrivateIpv6Address(address)
  }

  return false
}

function isPrivateIpv4Address(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10))
  const [first, second] = parts

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
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
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  )
}

function isPrivateIpv6Address(address: string) {
  const normalized = address.toLowerCase()
  const embeddedIpv4 = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)

  if (embeddedIpv4?.[1] && isPrivateIpv4Address(embeddedIpv4[1])) {
    return true
  }

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:0" ||
    normalized === "0:0:0:0:0:0:0:1"
  ) {
    return true
  }

  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16)

  return (
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  )
}

export async function assertUrlResolvesPublicly(
  url: URL,
  lookup: typeof dns.lookup = dns.lookup
) {
  const hostname = url.hostname

  assertPublicHostname(hostname)

  if (net.isIP(hostname)) {
    return
  }

  let addresses: Array<{ address: string }>

  try {
    addresses = (await lookup(hostname, {
      all: true,
      verbatim: true,
    })) as Array<{ address: string }>
  } catch {
    throw new UnsafeUrlError("The URL hostname could not be resolved.")
  }

  if (!addresses.length) {
    throw new UnsafeUrlError("The URL hostname could not be resolved.")
  }

  for (const address of addresses) {
    if (isPrivateIpAddress(address.address)) {
      throw new UnsafeUrlError("Local and internal hostnames are not allowed.")
    }
  }
}

export async function safeFetchText(
  inputUrl: URL,
  options: SafeFetchTextOptions = {}
): Promise<SafeFetchTextResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const lookup = options.lookup ?? dns.lookup
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let url = inputUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertUrlResolvesPublicly(url, lookup)

    const signal = AbortSignal.timeout(timeoutMs)
    let response: Response

    try {
      response = await fetchImpl(url, {
        headers: {
          accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
          "user-agent": "ArcticRSS/0.1 (+https://arcticrss.com)",
        },
        redirect: "manual",
        signal,
      })
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === "TimeoutError")
      ) {
        throw new FeedFetchError("The URL request timed out.")
      }

      throw error
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

    return {
      contentType: response.headers.get("content-type") ?? "",
      text: await readResponseText(response, maxBytes),
      url,
    }
  }

  throw new FeedFetchError("The URL redirected too many times.")
}

async function readResponseText(response: Response, maxBytes: number) {
  const contentLength = response.headers.get("content-length")

  if (contentLength && Number(contentLength) > maxBytes) {
    throw new FeedFetchError("The response is too large to inspect safely.")
  }

  if (!response.body) {
    return response.text()
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

  return new TextDecoder().decode(Buffer.concat(chunks, received))
}
