import { randomUUID } from "node:crypto"

import { afterAll, describe, expect, test } from "vitest"

import { getPrisma } from "@/lib/db"

import {
  createPkceS256Challenge,
  exchangeDeviceAuthorizationCode,
  issueDeviceAuthorizationCode,
  listMobileDeviceSessions,
  authenticateMobileAccessToken,
  MobileAuthError,
  refreshMobileDeviceSession,
  revokeAllMobileDeviceSessions,
  revokeMobileDeviceSession,
} from "./mobile-auth"

const databaseTest = process.env.CI ? test : test.skip
const accessTokenEnvironment = { AUTH_SECRET: "phase-eleven-test-secret-that-is-long-enough" }
const now = new Date("2026-08-10T12:00:00.000Z")

describe("mobile device sessions in PostgreSQL", () => {
  const userIds: string[] = []
  let prisma: ReturnType<typeof getPrisma> | null = null

  afterAll(async () => {
    if (prisma && userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
  })

  databaseTest(
    "enforces PKCE, exact redirect URI, one-time codes, and fresh account state",
    async () => {
      prisma = getPrisma()
      const user = await createUser(prisma, userIds)
      const verifier = "v".repeat(43)
      const authorizationRequest = deviceAuthorizationRequest(verifier)
      const issued = await issueDeviceAuthorizationCode({
        authVersion: user.authVersion,
        now,
        request: authorizationRequest,
        store: prisma,
        userId: user.id,
      })

      await expect(
        exchangeDeviceAuthorizationCode({
          accessTokenEnvironment,
          now,
          request: {
            code: issued.code,
            codeVerifier: "w".repeat(43),
            nonce: authorizationRequest.nonce,
            redirectUri: authorizationRequest.redirectUri,
          },
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)

      await expect(
        exchangeDeviceAuthorizationCode({
          accessTokenEnvironment,
          now,
          request: {
            code: issued.code,
            codeVerifier: verifier,
            nonce: authorizationRequest.nonce,
            redirectUri: "arcticrss://auth/wrong" as never,
          },
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)

      const tokens = await exchangeDeviceAuthorizationCode({
        accessTokenEnvironment,
        now,
        request: {
          code: issued.code,
          codeVerifier: verifier,
          nonce: authorizationRequest.nonce,
          redirectUri: authorizationRequest.redirectUri,
        },
        store: prisma,
      })
      expect(tokens.accessToken).not.toBe(tokens.refreshToken)

      await expect(
        exchangeDeviceAuthorizationCode({
          accessTokenEnvironment,
          now,
          request: {
            code: issued.code,
            codeVerifier: verifier,
            nonce: authorizationRequest.nonce,
            redirectUri: authorizationRequest.redirectUri,
          },
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)

      const expired = await issueDeviceAuthorizationCode({
        authVersion: user.authVersion,
        now,
        request: authorizationRequest,
        store: prisma,
        userId: user.id,
      })
      await expect(
        exchangeDeviceAuthorizationCode({
          accessTokenEnvironment,
          now: new Date(expired.expiresAt.getTime() + 1),
          request: {
            code: expired.code,
            codeVerifier: verifier,
            nonce: authorizationRequest.nonce,
            redirectUri: authorizationRequest.redirectUri,
          },
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)
    },
  )

  databaseTest(
    "revokes a token family after a concurrent refresh race or account invalidation",
    async () => {
      prisma = getPrisma()
      const user = await createUser(prisma, userIds)
      const verifier = "r".repeat(43)
      const authorizationRequest = deviceAuthorizationRequest(verifier)
      const issued = await issueDeviceAuthorizationCode({
        authVersion: user.authVersion,
        now,
        request: authorizationRequest,
        store: prisma,
        userId: user.id,
      })
      const tokens = await exchangeDeviceAuthorizationCode({
        accessTokenEnvironment,
        now,
        request: {
          code: issued.code,
          codeVerifier: verifier,
          nonce: authorizationRequest.nonce,
          redirectUri: authorizationRequest.redirectUri,
        },
        store: prisma,
      })

      const results = await Promise.allSettled([
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 1_000),
          refreshToken: tokens.refreshToken,
          store: prisma,
        }),
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 1_000),
          refreshToken: tokens.refreshToken,
          store: prisma,
        }),
      ])
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
      const sessionsAfterReuse = await prisma.deviceSession.findMany({
        where: { userId: user.id },
      })
      expect(sessionsAfterReuse).not.toHaveLength(0)
      expect(sessionsAfterReuse.every((session) => session.revokedAt !== null)).toBe(true)

      await revokeAllMobileDeviceSessions({
        now: new Date(now.getTime() + 2_000),
        store: prisma,
        userId: user.id,
      })
      await expect(
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 3_000),
          refreshToken: tokens.refreshToken,
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "refresh-invalid" } satisfies Partial<MobileAuthError>)

      const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      await prisma.user.update({
        data: { authVersion: currentUser.authVersion + 1 },
        where: { id: user.id },
      })
      await expect(
        issueDeviceAuthorizationCode({
          authVersion: currentUser.authVersion,
          now,
          request: authorizationRequest,
          store: prisma,
          userId: user.id,
        }),
      ).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)
    },
  )

  databaseTest(
    "enforces the device cap and supports targeted and global device revocation",
    async () => {
      prisma = getPrisma()
      const user = await createUser(prisma, userIds)
      const tokens = [] as Awaited<ReturnType<typeof exchangeDeviceAuthorizationCode>>[]

      for (let index = 0; index < 5; index += 1) {
        const verifier = `${String(index)}${"d".repeat(42)}`
        const request = {
          ...deviceAuthorizationRequest(verifier),
          deviceName: `Test Android ${index + 1}`,
          nonce: `nonce-for-device-cap-test-${index}`,
          state: `state-for-device-cap-test-${index}`,
        }
        const issued = await issueDeviceAuthorizationCode({
          authVersion: user.authVersion,
          now,
          request,
          store: prisma,
          userId: user.id,
        })
        tokens.push(
          await exchangeDeviceAuthorizationCode({
            accessTokenEnvironment,
            now,
            request: {
              code: issued.code,
              codeVerifier: verifier,
              nonce: request.nonce,
              redirectUri: request.redirectUri,
            },
            store: prisma,
          }),
        )
      }

      await expect(listMobileDeviceSessions({ now, store: prisma, userId: user.id })).resolves.toHaveLength(5)

      const sixthRequest = {
        ...deviceAuthorizationRequest(`6${"d".repeat(42)}`),
        nonce: "nonce-for-device-cap-test-six",
        state: "state-for-device-cap-test-six",
      }
      const sixthCode = await issueDeviceAuthorizationCode({
        authVersion: user.authVersion,
        now,
        request: sixthRequest,
        store: prisma,
        userId: user.id,
      })
      await expect(
        exchangeDeviceAuthorizationCode({
          accessTokenEnvironment,
          now,
          request: {
            code: sixthCode.code,
            codeVerifier: `6${"d".repeat(42)}`,
            nonce: sixthRequest.nonce,
            redirectUri: sixthRequest.redirectUri,
          },
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "device-limit" } satisfies Partial<MobileAuthError>)

      const firstPrincipal = await authenticateMobileAccessToken({
        accessToken: tokens[0].accessToken,
        accessTokenEnvironment,
        now,
        store: prisma,
      })
      await expect(
        revokeMobileDeviceSession({ sessionId: firstPrincipal.deviceSessionId, store: prisma, userId: user.id }),
      ).resolves.toEqual({ revoked: true })
      await expect(
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 1_000),
          refreshToken: tokens[0].refreshToken,
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "refresh-invalid" } satisfies Partial<MobileAuthError>)

      await expect(revokeAllMobileDeviceSessions({ now, store: prisma, userId: user.id })).resolves.toEqual(
        expect.objectContaining({ revoked: expect.any(Number) }),
      )
      const sessionStore = prisma
      await expect(
        Promise.all(tokens.map((token) => refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 2_000),
          refreshToken: token.refreshToken,
          store: sessionStore,
        }))),
      ).rejects.toThrow()
    },
  )

  databaseTest(
    "revokes a refresh family when the account is disabled during its lifetime",
    async () => {
      prisma = getPrisma()
      const user = await createUser(prisma, userIds)
      const verifier = "z".repeat(43)
      const request = deviceAuthorizationRequest(verifier)
      const issued = await issueDeviceAuthorizationCode({
        authVersion: user.authVersion,
        now,
        request,
        store: prisma,
        userId: user.id,
      })
      const tokens = await exchangeDeviceAuthorizationCode({
        accessTokenEnvironment,
        now,
        request: {
          code: issued.code,
          codeVerifier: verifier,
          nonce: request.nonce,
          redirectUri: request.redirectUri,
        },
        store: prisma,
      })
      await prisma.user.update({ data: { disabledAt: new Date(now.getTime() + 1) }, where: { id: user.id } })

      await expect(
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 2_000),
          refreshToken: tokens.refreshToken,
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "refresh-invalid" } satisfies Partial<MobileAuthError>)
      const disabledSessions = await prisma.deviceSession.findMany({ where: { userId: user.id } })
      expect(disabledSessions.every((session) => session.revokedAt !== null)).toBe(true)

      await prisma.user.update({ data: { disabledAt: null }, where: { id: user.id } })
      const reenabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      const reenabledCode = await issueDeviceAuthorizationCode({
        authVersion: reenabled.authVersion,
        now: new Date(now.getTime() + 3_000),
        request,
        store: prisma,
        userId: user.id,
      })
      const reenabledTokens = await exchangeDeviceAuthorizationCode({
        accessTokenEnvironment,
        now: new Date(now.getTime() + 3_000),
        request: {
          code: reenabledCode.code,
          codeVerifier: verifier,
          nonce: request.nonce,
          redirectUri: request.redirectUri,
        },
        store: prisma,
      })
      await prisma.user.update({
        data: { authVersion: reenabled.authVersion + 1 },
        where: { id: user.id },
      })
      await expect(
        refreshMobileDeviceSession({
          accessTokenEnvironment,
          now: new Date(now.getTime() + 4_000),
          refreshToken: reenabledTokens.refreshToken,
          store: prisma,
        }),
      ).rejects.toMatchObject({ code: "refresh-invalid" } satisfies Partial<MobileAuthError>)
    },
  )
})

async function createUser(prisma: ReturnType<typeof getPrisma>, userIds: string[]) {
  const marker = randomUUID().replaceAll("-", "")
  const user = await prisma.user.create({
    data: { email: `mobile-auth-${marker}@example.test` },
  })
  userIds.push(user.id)
  return user
}

function deviceAuthorizationRequest(codeVerifier: string) {
  return {
    appVersion: "0.1.0-test",
    codeChallenge: createPkceS256Challenge(codeVerifier),
    codeChallengeMethod: "S256" as const,
    deviceName: "Test Android",
    nonce: "nonce-for-phase-eleven-test",
    platform: "android" as const,
    redirectUri: "arcticrss://auth/callback" as const,
    state: "state-for-phase-eleven-test",
  }
}
