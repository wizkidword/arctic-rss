import { createHmac, hkdfSync, scrypt, timingSafeEqual } from "node:crypto"

export const ACCOUNT_DELETION_HANDOFF_COOKIE = "arcticrss-account-deletion-handoff"
export const ACCOUNT_DELETION_HANDOFF_COOKIE_PATH = "/api/account/deletion/confirmation"
export const ACCOUNT_DELETION_HANDOFF_MAX_COOKIE_BYTES = 512

const HANDOFF_PREFIX = "arcticrss-account-deletion-handoff"
const HANDOFF_VERSION = "v2"
const LEGACY_HANDOFF_VERSION = "v1"
const MIN_SECRET_BYTES = 32
const HANDOFF_SIGNATURE_BYTES = 32
const MAX_PAYLOAD_SEGMENT_LENGTH = 256
const MAX_LEGACY_V1_REMAINING_LIFETIME_SECONDS = 15 * 60
const HANDOFF_SIGNATURE_DERIVATION_COST = 16_384
const HANDOFF_SIGNATURE_DERIVATION_CONTEXT = "arcticrss-account-deletion-handoff-v1"
const HANDOFF_V2_KEY_DERIVATION_CONTEXT = "arcticrss-account-deletion-handoff-v2"
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/

type AccountDeletionHandoffPayload = {
  exp: number
  tokenHash: string
}

type ParsedHandoff = {
  encodedPayload: string
  signature: Buffer
  version: typeof HANDOFF_VERSION | typeof LEGACY_HANDOFF_VERSION
}

let cachedV2SigningKey: { key: Buffer; secret: string } | undefined

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
    throw invalidHandoff()
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = signV2(encodedPayload, secret).toString("base64url")

  return `${HANDOFF_PREFIX}.${HANDOFF_VERSION}.${encodedPayload}.${signature}`
}

export async function verifyAccountDeletionHandoff(
  handoff: string,
  { now = new Date(), secret }: { now?: Date; secret: string }
) {
  assertSecret(secret)
  const parsed = parseHandoff(handoff)
  const payload = parsePayload(parsed.encodedPayload)
  const nowSeconds = Math.floor(now.getTime() / 1_000)

  if (
    payload.exp <= nowSeconds ||
    (parsed.version === LEGACY_HANDOFF_VERSION &&
      payload.exp > nowSeconds + MAX_LEGACY_V1_REMAINING_LIFETIME_SECONDS)
  ) {
    throw invalidHandoff()
  }

  const expectedSignature =
    parsed.version === HANDOFF_VERSION
      ? signV2(parsed.encodedPayload, secret)
      : await signLegacyV1(parsed.encodedPayload, secret)

  if (!signaturesMatch(parsed.signature, expectedSignature)) {
    throw invalidHandoff()
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

function parseHandoff(handoff: string): ParsedHandoff {
  if (Buffer.byteLength(handoff, "utf8") > ACCOUNT_DELETION_HANDOFF_MAX_COOKIE_BYTES) {
    throw invalidHandoff()
  }

  const [prefix, version, encodedPayload, suppliedSignature, ...extraParts] = handoff.split(".")

  if (
    prefix !== HANDOFF_PREFIX ||
    (version !== HANDOFF_VERSION && version !== LEGACY_HANDOFF_VERSION) ||
    !encodedPayload ||
    !suppliedSignature ||
    extraParts.length ||
    encodedPayload.length > MAX_PAYLOAD_SEGMENT_LENGTH
  ) {
    throw invalidHandoff()
  }

  decodeBase64url(encodedPayload)
  const signature = decodeBase64url(suppliedSignature)
  if (signature.length !== HANDOFF_SIGNATURE_BYTES) {
    throw invalidHandoff()
  }

  return { encodedPayload, signature, version }
}

function parsePayload(encodedPayload: string) {
  let payload: unknown
  try {
    payload = JSON.parse(decodeBase64url(encodedPayload).toString("utf8"))
  } catch {
    throw invalidHandoff()
  }

  if (!isPayload(payload)) {
    throw invalidHandoff()
  }

  return payload
}

function decodeBase64url(value: string) {
  if (!BASE64URL_SEGMENT.test(value)) {
    throw invalidHandoff()
  }

  const decoded = Buffer.from(value, "base64url")
  if (!decoded.length || decoded.toString("base64url") !== value) {
    throw invalidHandoff()
  }

  return decoded
}

function signV2(encodedPayload: string, secret: string) {
  return createHmac("sha256", getV2SigningKey(secret))
    .update(signingInput(HANDOFF_VERSION, encodedPayload))
    .digest()
}

function getV2SigningKey(secret: string) {
  if (cachedV2SigningKey?.secret === secret) {
    return cachedV2SigningKey.key
  }

  const key = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from(HANDOFF_PREFIX, "utf8"),
      Buffer.from(HANDOFF_V2_KEY_DERIVATION_CONTEXT, "utf8"),
      HANDOFF_SIGNATURE_BYTES
    )
  )
  cachedV2SigningKey = { key, secret }
  return key
}

async function signLegacyV1(encodedPayload: string, secret: string) {
  const signingInput = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      signingInputForLegacyV1(encodedPayload),
      HANDOFF_SIGNATURE_DERIVATION_CONTEXT,
      HANDOFF_SIGNATURE_BYTES,
      {
        N: HANDOFF_SIGNATURE_DERIVATION_COST,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.from(derivedKey))
      }
    )
  })

  return createHmac("sha256", secret).update(signingInput).digest()
}

function signingInput(version: string, encodedPayload: string) {
  return `${HANDOFF_PREFIX}.${version}.${encodedPayload}`
}

function signingInputForLegacyV1(encodedPayload: string) {
  return signingInput(LEGACY_HANDOFF_VERSION, encodedPayload)
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

function signaturesMatch(supplied: Buffer, expected: Buffer) {
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

function invalidHandoff() {
  return new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
}
