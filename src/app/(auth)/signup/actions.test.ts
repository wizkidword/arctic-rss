import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  hashPassword: vi.fn(),
  notifyAdminsOfNewRegistration: vi.fn(),
  enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getCurrentRequestIp: vi.fn().mockResolvedValue(null),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
  requestEmailVerification: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
}))

vi.mock("@/lib/email-verification", () => ({
  requestEmailVerification: mocks.requestEmailVerification,
}))

vi.mock("@/lib/registration-notifications", () => ({
  notifyAdminsOfNewRegistration: mocks.notifyAdminsOfNewRegistration,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getCurrentRequestIp: mocks.getCurrentRequestIp,
  getRateLimitErrorMessage: () => "Too many requests. Please wait a few minutes and try again.",
}))

vi.mock("@/lib/turnstile", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}))

import { signupAction } from "./actions"

function createSignupFormData() {
  const formData = new FormData()
  formData.set("email", "reader@example.com")
  formData.set("name", "Example Reader")
  formData.set("password", "correct horse battery staple")
  formData.set("cf-turnstile-response", "turnstile-token")

  return formData
}

describe("signupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hashPassword.mockResolvedValue("hashed-password")
    mocks.verifyTurnstileToken.mockResolvedValue({ success: true })
    mocks.requestEmailVerification.mockResolvedValue({ status: "sent" })
    mocks.notifyAdminsOfNewRegistration.mockResolvedValue({
      recipientCount: 1,
      status: "sent",
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("notifies administrators after creating a credentials signup", async () => {
    const createdAt = new Date("2026-06-28T18:30:00.000Z")
    const prisma = {
      user: {
        create: vi.fn(async () => ({
          createdAt,
          email: "reader@example.com",
          id: "user-1",
          name: "Example Reader",
        })),
        delete: vi.fn(),
        findUnique: vi.fn(async () => null),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)

    await expect(
      signupAction({}, createSignupFormData())
    ).rejects.toThrow("REDIRECT:/login?verify=1")

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "reader@example.com",
          name: "Example Reader",
          passwordHash: "hashed-password",
          plan: "FREE",
          role: "USER",
        }),
        select: {
          createdAt: true,
          email: true,
          id: true,
          name: true,
        },
      })
    )
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith({
      email: "reader@example.com",
      userId: "user-1",
    })
    expect(mocks.notifyAdminsOfNewRegistration).toHaveBeenCalledWith({
      email: "reader@example.com",
      name: "Example Reader",
      registeredAt: createdAt,
      source: "credentials",
      userId: "user-1",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/login?verify=1")
  })

  it("always creates a standard user even when a deprecated admin allowlist matches", async () => {
    vi.stubEnv("ADMIN_EMAILS", "reader@example.com")
    const prisma = {
      user: {
        create: vi.fn(async () => ({
          createdAt: new Date("2026-06-28T18:30:00.000Z"),
          email: "reader@example.com",
          id: "user-1",
          name: "Example Reader",
        })),
        delete: vi.fn(),
        findUnique: vi.fn(async () => null),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)

    await expect(
      signupAction({}, createSignupFormData())
    ).rejects.toThrow("REDIRECT:/login?verify=1")

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: "FREE",
          role: "USER",
        }),
      })
    )
  })

  it("still completes signup when the admin notification fails", async () => {
    const prisma = {
      user: {
        create: vi.fn(async () => ({
          createdAt: new Date("2026-06-28T18:30:00.000Z"),
          email: "reader@example.com",
          id: "user-1",
          name: "Example Reader",
        })),
        delete: vi.fn(),
        findUnique: vi.fn(async () => null),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)
    mocks.notifyAdminsOfNewRegistration.mockRejectedValue(
      new Error("SMTP unavailable")
    )

    await expect(
      signupAction({}, createSignupFormData())
    ).rejects.toThrow("REDIRECT:/login?verify=1")

    expect(prisma.user.delete).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith("/login?verify=1")
  })

  it("does not block signup when verification email delivery fails in soft-launch mode", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false")
    const prisma = {
      user: {
        create: vi.fn(async () => ({
          createdAt: new Date("2026-06-28T18:30:00.000Z"),
          email: "reader@example.com",
          id: "user-1",
          name: "Example Reader",
        })),
        delete: vi.fn(),
        findUnique: vi.fn(async () => null),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)
    mocks.requestEmailVerification.mockRejectedValue(new Error("SMTP delayed"))

    await expect(
      signupAction({}, createSignupFormData())
    ).rejects.toThrow("REDIRECT:/login?registered=1")

    expect(prisma.user.delete).not.toHaveBeenCalled()
    expect(mocks.notifyAdminsOfNewRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "reader@example.com",
        userId: "user-1",
      })
    )
    expect(mocks.redirect).toHaveBeenCalledWith("/login?registered=1")
  })

  it("does not consume a Turnstile token when the email already has an account", async () => {
    const prisma = {
      user: {
        create: vi.fn(),
        findUnique: vi.fn(async () => ({
          email: "reader@example.com",
          id: "user-existing",
        })),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)

    const result = await signupAction({}, createSignupFormData())

    expect(result).toEqual({
      message: "An account already exists for that email.",
      errors: {
        email: ["Use a different email or log in."],
      },
    })
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })
})
