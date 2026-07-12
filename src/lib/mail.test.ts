import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mailerMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mailerMocks.createTransport,
  },
}))

import {
  isPasswordResetEmailConfigured,
  isTransactionalEmailConfigured,
  sendSmartDigestEmail,
  sendAdminSignupNotificationEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
} from "./mail"

describe("mail configuration", () => {
  beforeEach(() => {
    mailerMocks.createTransport.mockReset()
    mailerMocks.sendMail.mockReset()
    mailerMocks.sendMail.mockResolvedValue(undefined)
    mailerMocks.createTransport.mockReturnValue({
      sendMail: mailerMocks.sendMail,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires SMTP host, user, and password before email is configured", () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com")
    vi.stubEnv("SMTP_USER", "")
    vi.stubEnv("SMTP_PASSWORD", "")

    expect(isPasswordResetEmailConfigured()).toBe(false)

    vi.stubEnv("SMTP_USER", "arcticrssreader@gmail.com")

    expect(isPasswordResetEmailConfigured()).toBe(false)

    vi.stubEnv("SMTP_PASSWORD", "app-password")

    expect(isPasswordResetEmailConfigured()).toBe(true)
    expect(isTransactionalEmailConfigured()).toBe(true)
  })

  it("returns verification links when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "")
    vi.stubEnv("NODE_ENV", "development")

    const result = await sendEmailVerificationEmail({
      to: "reader@example.com",
      verificationUrl: "https://arcticrss.com/verify-email?token=test",
    })

    expect(result).toEqual({
      status: "not-configured",
      url: "https://arcticrss.com/verify-email?token=test",
    })
  })

  it("accepts welcome emails as not configured when SMTP is missing", async () => {
    vi.stubEnv("SMTP_HOST", "")
    vi.stubEnv("NODE_ENV", "development")

    await expect(
      sendWelcomeEmail({ to: "reader@example.com" })
    ).resolves.toEqual({
      status: "not-configured",
    })
  })

  it("accepts admin signup notifications as not configured when SMTP is missing", async () => {
    vi.stubEnv("SMTP_HOST", "")
    vi.stubEnv("NODE_ENV", "development")

    await expect(
      sendAdminSignupNotificationEmail({
        registeredAt: new Date("2026-06-28T18:30:00.000Z"),
        source: "credentials",
        to: "owner@example.com",
        userEmail: "reader@example.com",
        userName: "Example Reader",
      })
    ).resolves.toEqual({
      status: "not-configured",
    })
  })

  it("uses the authenticated SMTP user as the sender when SMTP_FROM is omitted", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com")
    vi.stubEnv("SMTP_USER", "arcticrssreader@gmail.com")
    vi.stubEnv("SMTP_PASSWORD", "app-password")
    vi.stubEnv("SMTP_FROM", "")

    await sendWelcomeEmail({ to: "reader@example.com" })

    expect(mailerMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Arctic RSS <arcticrssreader@gmail.com>",
      })
    )
  })

  it("sends Smart Digest emails grouped by feed", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com")
    vi.stubEnv("SMTP_USER", "arcticrssreader@gmail.com")
    vi.stubEnv("SMTP_PASSWORD", "app-password")

    await sendSmartDigestEmail({
      digest: {
        articleCount: 2,
        id: "digest-1",
        items: [
          {
            articleTitle: "Climate talks resume",
            articleUrl: "https://example.com/climate",
            feedTitle: "World Desk",
            matchedTerms: ["climate"],
            publishedAt: new Date("2026-06-30T10:00:00.000Z"),
            reason: 'Matched "climate" in title.',
            summary: "Talks resumed.",
          },
          {
            articleTitle: "Energy grid update",
            articleUrl: "https://example.com/energy",
            feedTitle: "Energy Daily",
            matchedTerms: ["energy"],
            publishedAt: new Date("2026-06-30T09:00:00.000Z"),
            reason: 'Matched "energy" in title.',
            summary: "Grid upgrades continue.",
          },
        ],
        title: "Climate Watch - 2026-06-30",
        topicPrompt: "Climate and energy policy",
      },
      to: "reader@example.com",
    })

    expect(mailerMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Climate talks resume"),
        subject: "Climate Watch - 2026-06-30",
        text: expect.stringContaining("World Desk"),
        to: "reader@example.com",
      })
    )
    expect(mailerMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Energy Daily"),
      })
    )
  })
})
