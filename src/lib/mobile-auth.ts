import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto"

import type { PrismaClient } from "@/generated/prisma/client"
import { z } from "zod"

import { getPrisma } from "@/lib/db"

export const MOBILE_REDIRECT_URI = "arcticrss://auth/callback"
export const MOBILE_AUTHORIZATION_CODE_TTL_MS = 5 * 60_000
export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const MOBILE_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000
export const MAX_MOBILE_DEVICE_SESSIONS_PER_USER = 5

const PKCE_VALUE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/
const NONCE_PATTERN = /^[A-Za-z0-9._~-]{16,256}$/
const STATE_PATTERN = /^[A-Za-z0-9._~-]{16,512}$/
const TOKEN_HASH_CONTEXT = "arctic-rss:mobile-auth:v1:token"
const ACCESS_TOKEN_CONTEXT = "arctic-rss:mobile-auth:v1:access"

type MobileAuthStore = Pick<
  PrismaClient,
  "deviceAuthorizationCode" | "deviceSession" | "securityEvent" | "user" | "$transaction"
>

type ActiveMobileUser = {
  authVersion: number
  disabledAt: Date | null
  id: string
}

export type MobileDevice = {
  appVersion: string
  deviceName: string
  platform: "android"
}

export type IssuedDeviceAuthorizationCode = MobileDevice & {
  code: string
  expiresAt: Date
}

export type MobileSessionTokens = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
}

export type MobileDeviceSession = MobileDevice & {
  createdAt: Date
  id: string
  lastUsedAt: Date
}

export type MobileAccessPrincipal = {
  authVersion: number
  deviceSessionId: string
  userId: string
}

export type MobileAuthErrorCode =
  | "authorization-invalid"
  | "configuration"
  | "device-limit"
  | "refresh-invalid"

export class MobileAuthError extends Error {
  constructor(
    readonly code: MobileAuthErrorCode,
    message: string
  ) {
    super(message)
    this.name = "MobileAuthError"
  }
}

const mobileDeviceSchema = z
  .object({
    appVersion: z.string().trim().min(1).max(80),
    deviceName: z.string().trim().min(1).max(120),
    platform: z.literal("android"),
  })
  .strict()

const browserDeviceAuthorizationRequestSchema = mobileDeviceSchema
  .extend({
    codeChallenge: z.string().regex(PKCE_VALUE_PATTERN),
    codeChallengeMethod: z.literal("S256"),
    nonce: z.string().regex(NONCE_PATTERN),
    redirectUri: z.literal(MOBILE_REDIRECT_URI),
    state: z.string().regex(STATE_PATTERN),
  })
  .strict()

const deviceAuthorizationExchangeRequestSchema = z
  .object({
    code: z.string().min(32).max(512),
    codeVerifier: z.string().regex(PKCE_VALUE_PATTERN),
    nonce: z.string().regex(NONCE_PATTERN),
    redirectUri: z.literal(MOBILE_REDIRECT_URI),
  })
  .strict()

const mobileRefreshRequestSchema = z
  .object({ refreshToken: z.string().min(32).max(512) })
  .strict()

export type BrowserDeviceAuthorizationRequest = z.infer<
  typeof browserDeviceAuthorizationRequestSchema
>
export type DeviceAuthorizationExchangeRequest = z.infer<
  typeof deviceAuthorizationExchangeRequestSchema
>

export function parseBrowserDeviceAuthorizationRequest(searchParams: URLSearchParams) {
  const wireNames = {
    appVersion: "app_version",
    codeChallenge: "code_challenge",
    codeChallengeMethod: "code_challenge_method",
    deviceName: "device_name",
    nonce: "nonce",
    platform: "platform",
    redirectUri: "redirect_uri",
    state: "state",
  } as const
  const allowed = new Set<string>(Object.values(wireNames))

  if ([...searchParams.keys()].some((key) => !allowed.has(key))) {
    throw new MobileAuthError("authorization-invalid", "The authorization request is invalid.")
  }

  const values = Object.fromEntries(
    Object.entries(wireNames).map(([property, wireName]) => {
      const entries = searchParams.getAll(wireName)
      if (entries.length !== 1) {
        throw new MobileAuthError("authorization-invalid", "The authorization request is invalid.")
      }
      return [property, entries[0]]
    })
  )
  const parsed = browserDeviceAuthorizationRequestSchema.safeParse(values)

  if (!parsed.success) {
    throw new MobileAuthError("authorization-invalid", "The authorization request is invalid.")
  }

  return parsed.data
}

export function parseDeviceAuthorizationExchangeRequest(value: unknown) {
  const parsed = deviceAuthorizationExchangeRequestSchema.safeParse(value)

  if (!parsed.success) {
    throw new MobileAuthError("authorization-invalid", "The authorization exchange is invalid.")
  }

  return parsed.data
}

export function parseMobileRefreshRequest(value: unknown) {
  const parsed = mobileRefreshRequestSchema.safeParse(value)

  if (!parsed.success) {
    throw new MobileAuthError("refresh-invalid", "The refresh request is invalid.")
  }

  return parsed.data
}

export function createPkceS256Challenge(codeVerifier: string) {
  if (!PKCE_VALUE_PATTERN.test(codeVerifier)) {
    throw new MobileAuthError("authorization-invalid", "The PKCE verifier is invalid.")
  }

  return createHash("sha256").update(codeVerifier).digest("base64url")
}

export async function issueDeviceAuthorizationCode({
  authVersion,
  request,
  store = getPrisma(),
  userId,
  now = new Date(),
}: {
  authVersion: number
  request: BrowserDeviceAuthorizationRequest
  store?: MobileAuthStore
  userId: string
  now?: Date
}): Promise<IssuedDeviceAuthorizationCode> {
  const user = await store.user.findUnique({
    select: { authVersion: true, disabledAt: true, id: true },
    where: { id: userId },
  })
  assertActiveUser(user, authVersion, "authorization-invalid")

  const code = randomToken()
  const expiresAt = new Date(now.getTime() + MOBILE_AUTHORIZATION_CODE_TTL_MS)

  await store.$transaction(async (transaction) => {
    await transaction.deviceAuthorizationCode.create({
      data: {
        appVersion: request.appVersion,
        authVersion,
        codeChallenge: request.codeChallenge,
        codeChallengeMethod: request.codeChallengeMethod,
        codeHash: hashCredential(code),
        deviceName: request.deviceName,
        expiresAt,
        nonceHash: hashCredential(request.nonce),
        platform: request.platform,
        redirectUri: request.redirectUri,
        userId,
      },
    })
    await transaction.securityEvent.create({
      data: {
        eventType: "MOBILE_AUTHORIZATION_CODE_ISSUED",
        metadata: { platform: request.platform },
        userId,
      },
    })
  })

  return {
    appVersion: request.appVersion,
    code,
    deviceName: request.deviceName,
    expiresAt,
    platform: request.platform,
  }
}

export async function exchangeDeviceAuthorizationCode({
  accessTokenEnvironment = process.env,
  request,
  store = getPrisma(),
  now = new Date(),
}: {
  accessTokenEnvironment?: Readonly<Record<string, string | undefined>>
  request: DeviceAuthorizationExchangeRequest
  store?: MobileAuthStore
  now?: Date
}): Promise<MobileSessionTokens> {
  assertMobileAccessTokenConfiguration(accessTokenEnvironment)
  const authorizationCode = await store.deviceAuthorizationCode.findUnique({
    include: { user: { select: { authVersion: true, disabledAt: true, id: true } } },
    where: { codeHash: hashCredential(request.code) },
  })

  if (
    !authorizationCode ||
    authorizationCode.usedAt ||
    authorizationCode.expiresAt <= now ||
    authorizationCode.redirectUri !== request.redirectUri ||
    authorizationCode.codeChallengeMethod !== "S256" ||
    !safeEqual(authorizationCode.nonceHash, hashCredential(request.nonce)) ||
    !safeEqual(authorizationCode.codeChallenge, createPkceS256Challenge(request.codeVerifier))
  ) {
    throw new MobileAuthError("authorization-invalid", "The authorization code is invalid or expired.")
  }
  assertActiveUser(authorizationCode.user, authorizationCode.authVersion, "authorization-invalid")

  const refreshToken = randomToken()
  const refreshExpiresAt = new Date(now.getTime() + MOBILE_REFRESH_TOKEN_TTL_MS)
  const deviceSession = await store.$transaction(async (transaction) => {
    // Updating the user row serializes device-cap checks for one account. That
    // makes the count and session creation race-safe on PostgreSQL.
    const freshUser = await transaction.user.updateMany({
      data: { updatedAt: now },
      where: {
        authVersion: authorizationCode.authVersion,
        disabledAt: null,
        id: authorizationCode.userId,
      },
    })
    if (freshUser.count !== 1) {
      throw new MobileAuthError("authorization-invalid", "The authorization code is invalid or expired.")
    }

    const activeSessions = await transaction.deviceSession.count({
      where: {
        refreshExpiresAt: { gt: now },
        replacedById: null,
        revokedAt: null,
        userId: authorizationCode.userId,
      },
    })
    if (activeSessions >= MAX_MOBILE_DEVICE_SESSIONS_PER_USER) {
      throw new MobileAuthError(
        "device-limit",
        "This account already has the maximum number of mobile devices. Revoke a device first."
      )
    }

    const claimed = await transaction.deviceAuthorizationCode.updateMany({
      data: { usedAt: now },
      where: {
        authVersion: authorizationCode.authVersion,
        expiresAt: { gt: now },
        id: authorizationCode.id,
        usedAt: null,
        user: { is: { authVersion: authorizationCode.authVersion, disabledAt: null } },
      },
    })
    if (claimed.count !== 1) {
      throw new MobileAuthError("authorization-invalid", "The authorization code is invalid or expired.")
    }

    const session = await transaction.deviceSession.create({
      data: {
        accessIssuedAt: now,
        appVersion: authorizationCode.appVersion,
        authVersion: authorizationCode.authVersion,
        deviceName: authorizationCode.deviceName,
        lastUsedAt: now,
        platform: authorizationCode.platform,
        refreshExpiresAt,
        refreshTokenHash: hashCredential(refreshToken),
        tokenFamilyId: randomUUID(),
        userId: authorizationCode.userId,
      },
    })
    await transaction.securityEvent.create({
      data: {
        eventType: "MOBILE_DEVICE_SESSION_CREATED",
        metadata: { platform: authorizationCode.platform },
        userId: authorizationCode.userId,
      },
    })
    return session
  })

  return issueSessionTokens({
    accessTokenEnvironment,
    authVersion: deviceSession.authVersion,
    deviceSessionId: deviceSession.id,
    refreshToken,
    userId: deviceSession.userId,
    now,
  })
}

export async function refreshMobileDeviceSession({
  accessTokenEnvironment = process.env,
  refreshToken,
  store = getPrisma(),
  now = new Date(),
}: {
  accessTokenEnvironment?: Readonly<Record<string, string | undefined>>
  refreshToken: string
  store?: MobileAuthStore
  now?: Date
}): Promise<MobileSessionTokens> {
  assertMobileAccessTokenConfiguration(accessTokenEnvironment)
  const tokenHash = hashCredential(refreshToken)
  const previous = await store.deviceSession.findUnique({
    include: { user: { select: { authVersion: true, disabledAt: true, id: true } } },
    where: { refreshTokenHash: tokenHash },
  })

  if (!previous) {
    throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
  }
  if (previous.user.disabledAt || previous.user.authVersion !== previous.authVersion) {
    await revokeMobileDeviceFamily({
      eventType: "MOBILE_DEVICE_SESSION_INVALIDATED",
      now,
      store,
      tokenFamilyId: previous.tokenFamilyId,
      userId: previous.userId,
    })
    throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
  }
  if (previous.revokedAt || previous.refreshExpiresAt <= now) {
    throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
  }
  if (previous.replacedById) {
    await revokeMobileDeviceFamily({
      eventType: "MOBILE_DEVICE_REFRESH_REUSE_DETECTED",
      markReuse: true,
      now,
      store,
      tokenFamilyId: previous.tokenFamilyId,
      userId: previous.userId,
    })
    throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
  }

  const nextRefreshToken = randomToken()
  const refreshExpiresAt = new Date(now.getTime() + MOBILE_REFRESH_TOKEN_TTL_MS)
  let replacement: Awaited<ReturnType<typeof store.deviceSession.create>>

  try {
    replacement = await store.$transaction(async (transaction) => {
      const current = await transaction.deviceSession.findUnique({
        include: { user: { select: { authVersion: true, disabledAt: true, id: true } } },
        where: { id: previous.id },
      })
      if (!current || current.refreshTokenHash !== tokenHash || current.revokedAt) {
        throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
      }
      if (current.replacedById) {
        throw new RefreshReuseDetectedError()
      }
      if (current.user.disabledAt || current.user.authVersion !== current.authVersion) {
        throw new RefreshAccountInvalidatedError()
      }
      if (current.refreshExpiresAt <= now) {
        throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
      }

      const next = await transaction.deviceSession.create({
        data: {
          accessIssuedAt: now,
          appVersion: current.appVersion,
          authVersion: current.authVersion,
          deviceName: current.deviceName,
          lastUsedAt: now,
          platform: current.platform,
          refreshExpiresAt,
          refreshTokenHash: hashCredential(nextRefreshToken),
          tokenFamilyId: current.tokenFamilyId,
          userId: current.userId,
        },
      })
      const consumed = await transaction.deviceSession.updateMany({
        data: { lastUsedAt: now, replacedById: next.id },
        where: {
          id: current.id,
          refreshExpiresAt: { gt: now },
          replacedById: null,
          revokedAt: null,
        },
      })
      if (consumed.count !== 1) {
        throw new RefreshReuseDetectedError()
      }
      await transaction.securityEvent.create({
        data: {
          eventType: "MOBILE_DEVICE_REFRESH_ROTATED",
          metadata: { platform: current.platform },
          userId: current.userId,
        },
      })
      return next
    })
  } catch (error) {
    if (error instanceof RefreshReuseDetectedError) {
      await revokeMobileDeviceFamily({
        eventType: "MOBILE_DEVICE_REFRESH_REUSE_DETECTED",
        markReuse: true,
        now,
        store,
        tokenFamilyId: previous.tokenFamilyId,
        userId: previous.userId,
      })
      throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
    }
    if (error instanceof RefreshAccountInvalidatedError) {
      await revokeMobileDeviceFamily({
        eventType: "MOBILE_DEVICE_SESSION_INVALIDATED",
        now,
        store,
        tokenFamilyId: previous.tokenFamilyId,
        userId: previous.userId,
      })
      throw new MobileAuthError("refresh-invalid", "The refresh token is invalid or expired.")
    }
    throw error
  }

  return issueSessionTokens({
    accessTokenEnvironment,
    authVersion: replacement.authVersion,
    deviceSessionId: replacement.id,
    refreshToken: nextRefreshToken,
    userId: replacement.userId,
    now,
  })
}

export async function authenticateMobileAccessToken({
  accessToken,
  accessTokenEnvironment = process.env,
  store = getPrisma(),
  now = new Date(),
}: {
  accessToken: string
  accessTokenEnvironment?: Readonly<Record<string, string | undefined>>
  store?: MobileAuthStore
  now?: Date
}): Promise<MobileAccessPrincipal> {
  const payload = parseMobileAccessToken(accessToken, accessTokenEnvironment, now)
  const session = await store.deviceSession.findUnique({
    include: { user: { select: { authVersion: true, disabledAt: true, id: true } } },
    where: { id: payload.sid },
  })

  if (
    !session ||
    session.userId !== payload.sub ||
    session.authVersion !== payload.av ||
    session.user.disabledAt ||
    session.user.authVersion !== payload.av ||
    session.revokedAt ||
    session.replacedById ||
    session.refreshExpiresAt <= now
  ) {
    throw new MobileAuthError("refresh-invalid", "The access token is invalid or expired.")
  }

  const touched = await store.deviceSession.updateMany({
    data: { lastUsedAt: now },
    where: { id: session.id, replacedById: null, revokedAt: null, userId: session.userId },
  })
  if (touched.count !== 1) {
    throw new MobileAuthError("refresh-invalid", "The access token is invalid or expired.")
  }

  return { authVersion: payload.av, deviceSessionId: session.id, userId: session.userId }
}

export async function listMobileDeviceSessions({
  store = getPrisma(),
  userId,
  now = new Date(),
}: {
  store?: MobileAuthStore
  userId: string
  now?: Date
}): Promise<MobileDeviceSession[]> {
  return store.deviceSession.findMany({
    orderBy: { lastUsedAt: "desc" },
    select: {
      appVersion: true,
      createdAt: true,
      deviceName: true,
      id: true,
      lastUsedAt: true,
      platform: true,
    },
    where: {
      refreshExpiresAt: { gt: now },
      replacedById: null,
      revokedAt: null,
      userId,
    },
  }) as Promise<MobileDeviceSession[]>
}

export async function revokeMobileDeviceSession({
  now = new Date(),
  sessionId,
  store = getPrisma(),
  userId,
}: {
  now?: Date
  sessionId: string
  store?: MobileAuthStore
  userId: string
}) {
  const session = await store.deviceSession.findFirst({
    select: { tokenFamilyId: true },
    where: { id: sessionId, userId },
  })
  if (!session) {
    return { revoked: false }
  }

  await revokeMobileDeviceFamily({
    eventType: "MOBILE_DEVICE_SESSION_REVOKED",
    now,
    store,
    tokenFamilyId: session.tokenFamilyId,
    userId,
  })
  return { revoked: true }
}

export async function revokeAllMobileDeviceSessions({
  now = new Date(),
  store = getPrisma(),
  userId,
}: {
  now?: Date
  store?: MobileAuthStore
  userId: string
}) {
  return store.$transaction(async (transaction) => {
    const revoked = await transaction.deviceSession.updateMany({
      data: { revokedAt: now },
      where: { revokedAt: null, userId },
    })
    if (revoked.count) {
      await transaction.securityEvent.create({
        data: { eventType: "MOBILE_DEVICE_SESSIONS_REVOKED_ALL", userId },
      })
    }
    return { revoked: revoked.count }
  })
}

function issueSessionTokens({
  accessTokenEnvironment,
  authVersion,
  deviceSessionId,
  refreshToken,
  userId,
  now,
}: {
  accessTokenEnvironment: Readonly<Record<string, string | undefined>>
  authVersion: number
  deviceSessionId: string
  refreshToken: string
  userId: string
  now: Date
}): MobileSessionTokens {
  return {
    accessToken: createMobileAccessToken(
      { av: authVersion, sid: deviceSessionId, sub: userId },
      accessTokenEnvironment,
      now
    ),
    accessTokenExpiresIn: MOBILE_ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  }
}

export function createMobileAccessToken(
  principal: Pick<MobileAccessPrincipal, "authVersion" | "deviceSessionId" | "userId"> | {
    av: number
    sid: string
    sub: string
  },
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  const payload = "authVersion" in principal
    ? { av: principal.authVersion, sid: principal.deviceSessionId, sub: principal.userId }
    : principal
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(now.getTime() / 1_000) + MOBILE_ACCESS_TOKEN_TTL_SECONDS,
      iat: Math.floor(now.getTime() / 1_000),
      v: 1,
    })
  ).toString("base64url")
  const signature = createHmac("sha256", getAccessTokenSigningKey(environment))
    .update(`${ACCESS_TOKEN_CONTEXT}.${encodedPayload}`)
    .digest("base64url")

  return `arctic-mobile-v1.${encodedPayload}.${signature}`
}

export function assertMobileAccessTokenConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  getAccessTokenSigningKey(environment)
}

function parseMobileAccessToken(
  accessToken: string,
  environment: Readonly<Record<string, string | undefined>>,
  now: Date
) {
  const parts = accessToken.split(".")
  if (parts.length !== 3 || parts[0] !== "arctic-mobile-v1" || parts[1].length > 1_024) {
    throw new MobileAuthError("refresh-invalid", "The access token is invalid or expired.")
  }
  const expectedSignature = createHmac("sha256", getAccessTokenSigningKey(environment))
    .update(`${ACCESS_TOKEN_CONTEXT}.${parts[1]}`)
    .digest("base64url")
  if (!safeEqual(parts[2], expectedSignature)) {
    throw new MobileAuthError("refresh-invalid", "The access token is invalid or expired.")
  }

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
    const isValid =
      parsed.v === 1 &&
      typeof parsed.sub === "string" &&
      typeof parsed.sid === "string" &&
      Number.isInteger(parsed.av) &&
      typeof parsed.exp === "number" &&
      Number.isInteger(parsed.exp) &&
      parsed.exp * 1_000 > now.getTime()
    if (!isValid) {
      throw new Error("invalid access token payload")
    }
    return { av: parsed.av as number, sid: parsed.sid as string, sub: parsed.sub as string }
  } catch {
    throw new MobileAuthError("refresh-invalid", "The access token is invalid or expired.")
  }
}

function getAccessTokenSigningKey(environment: Readonly<Record<string, string | undefined>>) {
  const authSecret = environment.AUTH_SECRET?.trim()
  if (!authSecret || authSecret.length < 32) {
    throw new MobileAuthError("configuration", "Mobile authentication is temporarily unavailable.")
  }
  return createHash("sha256")
    .update(`${ACCESS_TOKEN_CONTEXT}:${authSecret}`)
    .digest()
}

async function revokeMobileDeviceFamily({
  eventType,
  markReuse = false,
  now,
  store,
  tokenFamilyId,
  userId,
}: {
  eventType: string
  markReuse?: boolean
  now: Date
  store: MobileAuthStore
  tokenFamilyId: string
  userId: string
}) {
  await store.$transaction(async (transaction) => {
    await transaction.deviceSession.updateMany({
      data: { ...(markReuse ? { reuseDetectedAt: now } : {}), revokedAt: now },
      where: { revokedAt: null, tokenFamilyId, userId },
    })
    await transaction.securityEvent.create({
      data: { eventType, userId },
    })
  })
}

function assertActiveUser(
  user: ActiveMobileUser | null | undefined,
  authVersion: number,
  code: Extract<MobileAuthErrorCode, "authorization-invalid" | "refresh-invalid">
) {
  if (!user || user.disabledAt || user.authVersion !== authVersion) {
    throw new MobileAuthError(code, "The account is no longer authorized.")
  }
}

function hashCredential(value: string) {
  return createHash("sha256").update(`${TOKEN_HASH_CONTEXT}:${value}`).digest("hex")
}

function randomToken() {
  return randomBytes(32).toString("base64url")
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

class RefreshReuseDetectedError extends Error {}

class RefreshAccountInvalidatedError extends Error {}
