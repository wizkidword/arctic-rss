import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const TOKEN_PREFIX = "arcticirc"
const TOKEN_VERSION = "v1"
const DEFAULT_TOKEN_TTL_SECONDS = 60
const MAX_TOKEN_TTL_SECONDS = 300
const MIN_TOKEN_TTL_SECONDS = 15
const MIN_TOKEN_SECRET_BYTES = 32

export type ChatConnectionTokenPayload = {
  authVersion: number
  exp: number
  handle: string
  iat: number
  jti: string
  plan: "FREE" | "PRO" | "ADMIN"
  profileId: string
  role: "USER" | "ADMIN"
  userId: string
}

export class ChatConnectionTokenError extends Error {
  constructor(
    message: string,
    readonly code: "expired" | "invalid" | "misconfigured"
  ) {
    super(message)
    this.name = "ChatConnectionTokenError"
  }
}

export function getChatConnectionTokenSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const secret = environment.ARCTIC_IRC_TOKEN_SECRET?.trim()

  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_TOKEN_SECRET_BYTES) {
    throw new ChatConnectionTokenError(
      "The chat connection token secret must be at least 32 bytes.",
      "misconfigured"
    )
  }

  const rawTtl = environment.ARCTIC_IRC_TOKEN_TTL_SECONDS?.trim()
  const ttlSeconds = rawTtl ? Number(rawTtl) : DEFAULT_TOKEN_TTL_SECONDS

  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_TOKEN_TTL_SECONDS ||
    ttlSeconds > MAX_TOKEN_TTL_SECONDS
  ) {
    throw new ChatConnectionTokenError(
      `The chat connection token TTL must be an integer between ${MIN_TOKEN_TTL_SECONDS} and ${MAX_TOKEN_TTL_SECONDS} seconds.`,
      "misconfigured"
    )
  }

  return { secret, ttlSeconds }
}

export function issueChatConnectionToken(
  identity: Omit<ChatConnectionTokenPayload, "exp" | "iat" | "jti">,
  {
    now = new Date(),
    secret,
    tokenId = randomUUID(),
    ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  }: {
    now?: Date
    secret: string
    tokenId?: string
    ttlSeconds?: number
  }
) {
  assertTokenSecret(secret)

  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_TOKEN_TTL_SECONDS ||
    ttlSeconds > MAX_TOKEN_TTL_SECONDS
  ) {
    throw new ChatConnectionTokenError("Invalid chat token TTL.", "misconfigured")
  }

  const iat = Math.floor(now.getTime() / 1_000)
  const payload: ChatConnectionTokenPayload = {
    ...identity,
    exp: iat + ttlSeconds,
    iat,
    jti: tokenId,
  }
  const encodedPayload = encodePayload(payload)
  const signature = createSignature(encodedPayload, secret)

  return {
    payload,
    token: `${TOKEN_PREFIX}.${TOKEN_VERSION}.${encodedPayload}.${signature}`,
  }
}

export function verifyChatConnectionToken(
  token: string,
  {
    now = new Date(),
    secret,
  }: {
    now?: Date
    secret: string
  }
) {
  assertTokenSecret(secret)
  const [prefix, version, encodedPayload, suppliedSignature, ...extraParts] =
    token.split(".")

  if (
    prefix !== TOKEN_PREFIX ||
    version !== TOKEN_VERSION ||
    !encodedPayload ||
    !suppliedSignature ||
    extraParts.length
  ) {
    throw new ChatConnectionTokenError("Invalid chat connection token.", "invalid")
  }

  const expectedSignature = createSignature(encodedPayload, secret)

  if (!signaturesMatch(suppliedSignature, expectedSignature)) {
    throw new ChatConnectionTokenError("Invalid chat connection token.", "invalid")
  }

  const payload = parsePayload(encodedPayload)
  const nowSeconds = Math.floor(now.getTime() / 1_000)

  if (payload.exp <= nowSeconds) {
    throw new ChatConnectionTokenError("Chat connection token has expired.", "expired")
  }

  return payload
}

function assertTokenSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < MIN_TOKEN_SECRET_BYTES) {
    throw new ChatConnectionTokenError(
      "The chat connection token secret must be at least 32 bytes.",
      "misconfigured"
    )
  }
}

function createSignature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_PREFIX}.${TOKEN_VERSION}.${encodedPayload}`)
    .digest("base64url")
}

function encodePayload(payload: ChatConnectionTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function parsePayload(encodedPayload: string) {
  let payload: unknown

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  } catch {
    throw new ChatConnectionTokenError("Invalid chat connection token.", "invalid")
  }

  if (!isChatConnectionTokenPayload(payload)) {
    throw new ChatConnectionTokenError("Invalid chat connection token.", "invalid")
  }

  return payload
}

function isChatConnectionTokenPayload(
  value: unknown
): value is ChatConnectionTokenPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    isNonNegativeInteger(payload.authVersion) &&
    isPositiveInteger(payload.exp) &&
    typeof payload.handle === "string" &&
    payload.handle.length > 0 &&
    isPositiveInteger(payload.iat) &&
    typeof payload.jti === "string" &&
    payload.jti.length >= 16 &&
    (payload.plan === "FREE" || payload.plan === "PRO" || payload.plan === "ADMIN") &&
    typeof payload.profileId === "string" &&
    payload.profileId.length > 0 &&
    (payload.role === "USER" || payload.role === "ADMIN") &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0
  )
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function signaturesMatch(suppliedSignature: string, expectedSignature: string) {
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)

  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
