import { createHmac, scryptSync, timingSafeEqual } from "node:crypto"

export const ACCOUNT_DELETION_HANDOFF_COOKIE = "arcticrss-account-deletion-handoff"
export const ACCOUNT_DELETION_HANDOFF_COOKIE_PATH = "/api/account/deletion/confirmation"

const HANDOFF_PREFIX = "arcticrss-account-deletion-handoff"
const HANDOFF_VERSION = "v1"
const MIN_SECRET_BYTES = 32
const HANDOFF_SIGNATURE_DERIVATION_BYTES = 32
const HANDOFF_SIGNATURE_DERIVATION_COST = 16_384
const HANDOFF_SIGNATURE_DERIVATION_CONTEXT = "arcticrss-account-deletion-handoff-v1"

type AccountDeletionHandoffPayload = {
  exp: number
  tokenHash: string
}

export class AccountDeletionHandoffError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccountDeletionHandoffError"
  }
}

export function getAccountDeletionHandoffSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const secret = environment.AUTH_SECRET?.trim()

  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new AccountDeletionHandoffError(
      "Account deletion handoff requires an AUTH_SECRET of at least 32 bytes."
    )
  }

  return secret
}

export function createAccountDeletionHandoff(
  { expiresAt, tokenHash }: { expiresAt: Date; tokenHash: string },
  { now = new Date(), secret }: { now?: Date; secret: string }
) {
  assertSecret(secret)
  const payload: AccountDeletionHandoffPayload = {
    exp: Math.floor(expiresAt.getTime() / 1_000),
    tokenHash,
  }

  if (!isPayload(payload) || payload.exp <= Math.floor(now.getTime() / 1_000)) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = sign(encodedPayload, secret)

  return `${HANDOFF_PREFIX}.${HANDOFF_VERSION}.${encodedPayload}.${signature}`
}

export function verifyAccountDeletionHandoff(
  handoff: string,
  { now = new Date(), secret }: { now?: Date; secret: string }
) {
  assertSecret(secret)
  const [prefix, version, encodedPayload, suppliedSignature, ...extraParts] = handoff.split(".")

  if (
    prefix !== HANDOFF_PREFIX ||
    version !== HANDOFF_VERSION ||
    !encodedPayload ||
    !suppliedSignature ||
    extraParts.length
  ) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  const expectedSignature = sign(encodedPayload, secret)

  if (!signaturesMatch(suppliedSignature, expectedSignature)) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  } catch {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  if (!isPayload(payload) || payload.exp <= Math.floor(now.getTime() / 1_000)) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  return payload
}

export function makeAccountDeletionHandoffCookie(
  handoff: string,
  { expiresAt, now = new Date(), secure = process.env.NODE_ENV === "production" }: {
    expiresAt: Date
    now?: Date
    secure?: boolean
  }
) {
  const maxAgeSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000))

  return [
    `${ACCOUNT_DELETION_HANDOFF_COOKIE}=${handoff}`,
    "HttpOnly",
    `Max-Age=${maxAgeSeconds}`,
    `Path=${ACCOUNT_DELETION_HANDOFF_COOKIE_PATH}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ")
}

export function clearAccountDeletionHandoffCookie({
  secure = process.env.NODE_ENV === "production",
}: {
  secure?: boolean
} = {}) {
  return [
    `${ACCOUNT_DELETION_HANDOFF_COOKIE}=`,
    "HttpOnly",
    "Max-Age=0",
    `Path=${ACCOUNT_DELETION_HANDOFF_COOKIE_PATH}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ")
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=")

    if (cookieName === name) {
      return valueParts.join("=") || null
    }
  }

  return null
}

function assertSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new AccountDeletionHandoffError(
      "Account deletion handoff requires an AUTH_SECRET of at least 32 bytes."
    )
  }
}

function sign(encodedPayload: string, secret: string) {
  const signingInput = scryptSync(
    `${HANDOFF_PREFIX}.${HANDOFF_VERSION}.${encodedPayload}`,
    HANDOFF_SIGNATURE_DERIVATION_CONTEXT,
    HANDOFF_SIGNATURE_DERIVATION_BYTES,
    {
      N: HANDOFF_SIGNATURE_DERIVATION_COST,
      maxmem: 64 * 1024 * 1024,
    }
  )

  return createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")
}

function isPayload(value: unknown): value is AccountDeletionHandoffPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    typeof payload.tokenHash === "string" &&
    /^[a-f0-9]{64}$/.test(payload.tokenHash) &&
    typeof payload.exp === "number" &&
    Number.isInteger(payload.exp) &&
    payload.exp > 0
  )
}

function signaturesMatch(suppliedSignature: string, expectedSignature: string) {
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)

  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
