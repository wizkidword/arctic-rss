import { describe, expect, it, vi } from "vitest"

import { notifyAdminsOfNewRegistration } from "./registration-notifications"

function createStore(adminEmails: string[]) {
  return {
    user: {
      findMany: vi.fn(async () =>
        adminEmails.map((email) => ({
          email,
        }))
      ),
    },
  }
}

describe("registration notifications", () => {
  it("emails active administrators when a reader registers", async () => {
    const registeredAt = new Date("2026-06-28T18:30:00.000Z")
    const store = createStore(["owner@example.com", "admin@example.com"])
    const sendAdminSignupNotificationEmail = vi.fn(async () => ({
      status: "sent" as const,
    }))

    const result = await notifyAdminsOfNewRegistration(
      {
        email: "reader@example.com",
        name: "Example Reader",
        registeredAt,
        source: "credentials",
        userId: "user-1",
      },
      {
        sendAdminSignupNotificationEmail,
        store,
      }
    )

    expect(result).toEqual({
      recipientCount: 2,
      status: "sent",
    })
    expect(store.user.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        email: true,
      },
      where: {
        disabledAt: null,
        role: "ADMIN",
      },
    })
    expect(sendAdminSignupNotificationEmail).toHaveBeenCalledWith({
      registeredAt,
      source: "credentials",
      to: "owner@example.com",
      userEmail: "reader@example.com",
      userName: "Example Reader",
    })
    expect(sendAdminSignupNotificationEmail).toHaveBeenCalledWith({
      registeredAt,
      source: "credentials",
      to: "admin@example.com",
      userEmail: "reader@example.com",
      userName: "Example Reader",
    })
  })

  it("skips notification when there are no administrator recipients", async () => {
    const store = createStore([])
    const sendAdminSignupNotificationEmail = vi.fn()

    await expect(
      notifyAdminsOfNewRegistration(
        {
          email: "reader@example.com",
          name: null,
          registeredAt: new Date("2026-06-28T18:30:00.000Z"),
          source: "google",
          userId: "user-1",
        },
        {
          sendAdminSignupNotificationEmail,
          store,
        }
      )
    ).resolves.toEqual({
      recipientCount: 0,
      status: "skipped",
    })
    expect(sendAdminSignupNotificationEmail).not.toHaveBeenCalled()
  })
})
