const DEFAULT_DEVELOPMENT_ORIGIN = "http://localhost:3000"

export type AppOriginEnvironment = {
  APP_ALLOWED_HOSTS?: string
  APP_ORIGIN?: string
  NODE_ENV?: string
}

export class AppOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AppOriginConfigurationError"
  }
}

function parseOrigin(value: string, name: string) {
  let origin: URL

  try {
    origin = new URL(value)
  } catch {
    throw new AppOriginConfigurationError(`${name} must be an absolute URL.`)
  }

  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    throw new AppOriginConfigurationError(`${name} must use HTTP or HTTPS.`)
  }

  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new AppOriginConfigurationError(
      `${name} must contain only a scheme, host, and optional port.`
    )
  }

  return origin
}

function parseHost(value: string, name: string) {
  const host = value.trim()

  if (
    !host ||
    host !== value ||
    host.includes(",") ||
    /[/?#@]/.test(host) ||
    host.includes("://")
  ) {
    throw new AppOriginConfigurationError(`${name} must be a single host.`)
  }

  let parsed: URL

  try {
    parsed = new URL(`https://${host}`)
  } catch {
    throw new AppOriginConfigurationError(`${name} must be a valid host.`)
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new AppOriginConfigurationError(`${name} must be a valid host.`)
  }

  return parsed.host
}

export function getAppOrigin(
  environment: AppOriginEnvironment = process.env
) {
  return parseOrigin(
    environment.APP_ORIGIN?.trim() || DEFAULT_DEVELOPMENT_ORIGIN,
    "APP_ORIGIN"
  )
}

export function assertProductionAppOrigin(
  environment: AppOriginEnvironment = process.env
) {
  if (environment.NODE_ENV === "production" && !environment.APP_ORIGIN?.trim()) {
    throw new AppOriginConfigurationError(
      "APP_ORIGIN must be configured in production."
    )
  }

  const origin = getAppOrigin(environment)

  if (environment.NODE_ENV === "production" && origin.protocol !== "https:") {
    throw new AppOriginConfigurationError(
      "APP_ORIGIN must use HTTPS in production."
    )
  }

  return origin
}

export function getAllowedAppHosts(
  environment: AppOriginEnvironment = process.env
) {
  const hosts = new Set([getAppOrigin(environment).host])
  const additionalHosts = environment.APP_ALLOWED_HOSTS?.split(",") ?? []

  for (const host of additionalHosts) {
    if (host.trim()) {
      hosts.add(parseHost(host, "APP_ALLOWED_HOSTS"))
    }
  }

  return hosts
}

export function normalizeRequestHost(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return parseHost(value, "Host")
  } catch {
    return null
  }
}

export function isAllowedAppHost(
  value: string | null,
  environment: AppOriginEnvironment = process.env
) {
  const host = normalizeRequestHost(value)

  return host ? getAllowedAppHosts(environment).has(host) : false
}

export function isLoopbackHost(value: string | null) {
  const host = normalizeRequestHost(value)

  if (!host) {
    return false
  }

  const hostname = new URL(`https://${host}`).hostname.toLowerCase()

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  )
}

export function buildAppUrl(
  path: string,
  environment: AppOriginEnvironment = process.env
) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new AppOriginConfigurationError(
      "Application URLs must use an absolute application path."
    )
  }

  const origin = getAppOrigin(environment)
  const url = new URL(path, origin)

  if (url.origin !== origin.origin) {
    throw new AppOriginConfigurationError(
      "Application URLs must remain on the canonical origin."
    )
  }

  return url
}
