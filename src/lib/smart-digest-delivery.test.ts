import { describe, expect, it, vi } from "vitest"

import {
  processSmartDigestEmailDeliveryWithClient,
  smartDigestDeliveryMessageId,
  type SmartDigestDeliveryStore,
} from "./smart-digest-delivery"

const now = new Date("2026-07-13T09:00:00.000Z")

describe("smart digest email delivery", () => {
  it("claims a pending delivery, sends one fixed message, and records success", async () => {
    const { mocks, store } = createStore()
    const sendDigestEmail = vi.fn().mockResolvedValue({
      providerMessageId: "<provider-id@example.test>",
      status: "sent",
    })

    await expect(
      processSmartDigestEmailDeliveryWithClient({
        now,
        runId: "run-1",
        sendDigestEmail,
        store,
      })
    ).resolves.toEqual({ status: "SENT" })

    expect(sendDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: smartDigestDeliveryMessageId("run-1"),
        to: "reader@example.test",
      })
    )
    expect(mocks.smartDigestUpdate).toHaveBeenCalledWith({
      data: {
        emailErrorMessage: null,
        emailedAt: now,
        emailStatus: "SENT",
      },
      where: { id: "digest-1" },
    })
    expect(mocks.digestRunUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailStatus: "SENT",
        providerMessageId: "<provider-id@example.test>",
      }),
      where: { id: "run-1" },
    })
  })

  it("records a failed delivery and lets its separate job retry", async () => {
    const { state, store } = createStore()
    const unavailable = vi.fn().mockRejectedValue(new Error("SMTP unavailable"))

    await expect(
      processSmartDigestEmailDeliveryWithClient({
        now,
        runId: "run-1",
        sendDigestEmail: unavailable,
        store,
      })
    ).rejects.toThrow("SMTP unavailable")
    expect(state.run.emailStatus).toBe("FAILED")

    const recovered = vi.fn().mockResolvedValue({ status: "sent" })
    await expect(
      processSmartDigestEmailDeliveryWithClient({
        now: new Date("2026-07-13T09:01:00.000Z"),
        runId: "run-1",
        sendDigestEmail: recovered,
        store,
      })
    ).resolves.toEqual({ status: "SENT" })
    expect(recovered).toHaveBeenCalledTimes(1)
  })

  it("does not resend when a prior worker may have sent before acknowledging", async () => {
    const { store } = createStore({
      emailStatus: "PROCESSING",
    })
    const sendDigestEmail = vi.fn()

    await expect(
      processSmartDigestEmailDeliveryWithClient({
        now,
        runId: "run-1",
        sendDigestEmail,
        store,
      })
    ).resolves.toEqual({ status: "SKIPPED" })

    expect(sendDigestEmail).not.toHaveBeenCalled()
  })

  it("uses a stable RFC-style message identifier", () => {
    expect(smartDigestDeliveryMessageId("run/1")).toBe(
      "<smart-digest-run-1@arcticrss.com>"
    )
  })
})

function createStore({ emailStatus = "PENDING" }: { emailStatus?: string } = {}) {
  const state = {
    run: {
      digest: {
        articleCount: 1,
        id: "digest-1",
        items: [
          {
            articleTitle: "Climate report",
            articleUrl: "https://example.test/climate",
            feedTitle: "North Feed",
            matchedTerms: ["climate"],
            position: 1,
            publishedAt: new Date("2026-07-13T08:00:00.000Z"),
            reason: 'Matched "climate" in title.',
            summary: "Climate update.",
          },
        ],
        title: "Climate Digest",
        topicPrompt: "Climate news",
      },
      emailAttempts: 0,
      emailStatus,
      id: "run-1",
      rule: {
        user: {
          email: "reader@example.test",
        },
      },
    },
  }
  const mocks = {
    digestRunUpdate: vi.fn((args) => {
      Object.assign(state.run, flattenUpdate(args.data))
      return Promise.resolve(undefined)
    }),
    smartDigestUpdate: vi.fn().mockResolvedValue(undefined),
  }
  const store = {
    $transaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback(store),
    digestRun: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(state.run)),
      update: mocks.digestRunUpdate,
      updateMany: vi.fn((args) => {
        const canClaim =
          ["PENDING", "FAILED"].includes(state.run.emailStatus) &&
          state.run.emailAttempts < 3

        if (!canClaim) {
          return Promise.resolve({ count: 0 })
        }

        Object.assign(state.run, flattenUpdate(args.data))
        return Promise.resolve({ count: 1 })
      }),
    },
    smartDigest: {
      update: mocks.smartDigestUpdate,
    },
  }

  return {
    mocks,
    state,
    store: store as unknown as SmartDigestDeliveryStore,
  }
}

function flattenUpdate(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "object" &&
      value !== null &&
      "increment" in value &&
      typeof value.increment === "number"
        ? value.increment
        : value,
    ])
  )
}
