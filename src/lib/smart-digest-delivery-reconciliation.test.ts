import { describe, expect, it, vi } from "vitest"

import {
  inspectSmartDigestEmailDeliveryWithStore,
  reconcileSmartDigestEmailDeliveryWithClient,
  SMART_DIGEST_DELIVERY_RETRY_CONFIRMED_MESSAGE,
  type SmartDigestDeliveryReconciliationStore,
} from "./smart-digest-delivery-reconciliation"

const now = new Date("2026-08-09T15:00:00.000Z")

describe("Smart Digest email delivery reconciliation", () => {
  it("exposes the provider message identifier without retrying", async () => {
    const { store } = createStore()

    await expect(
      inspectSmartDigestEmailDeliveryWithStore({
        runId: "run-1",
        store: store as unknown as SmartDigestDeliveryReconciliationStore,
      }),
    ).resolves.toMatchObject({
      emailStatus: "DELIVERY_UNKNOWN",
      providerMessageId: "<provider-id@example.test>",
    })
  })

  it("records an operator-confirmed delivery without queueing another email", async () => {
    const { enqueueEmail, state, store } = createStore()

    await expect(
      reconcileSmartDigestEmailDeliveryWithClient({
        decision: "CONFIRM_DELIVERED",
        enqueueEmail,
        now,
        runId: "run-1",
        store: store as unknown as SmartDigestDeliveryReconciliationStore,
      }),
    ).resolves.toEqual({
      emailStatus: "SENT",
      providerMessageId: "<provider-id@example.test>",
      runId: "run-1",
      status: "RECONCILED",
    })

    expect(state.run.emailStatus).toBe("SENT")
    expect(enqueueEmail).not.toHaveBeenCalled()
  })

  it("queues a retry only after an operator confirms non-delivery", async () => {
    const { enqueueEmail, state, store } = createStore()

    await expect(
      reconcileSmartDigestEmailDeliveryWithClient({
        decision: "CONFIRM_NOT_DELIVERED",
        enqueueEmail,
        now,
        runId: "run-1",
        store: store as unknown as SmartDigestDeliveryReconciliationStore,
      }),
    ).resolves.toMatchObject({ emailStatus: "PENDING", status: "RECONCILED" })

    expect(state.run.emailAttempts).toBe(0)
    expect(state.run.emailErrorMessage).toBe(
      SMART_DIGEST_DELIVERY_RETRY_CONFIRMED_MESSAGE,
    )
    expect(enqueueEmail).toHaveBeenCalledWith("run-1")
  })

  it("refuses to act on an ordinary retryable delivery", async () => {
    const { enqueueEmail, store } = createStore({ emailStatus: "PENDING" })

    await expect(
      reconcileSmartDigestEmailDeliveryWithClient({
        decision: "CONFIRM_NOT_DELIVERED",
        enqueueEmail,
        now,
        runId: "run-1",
        store: store as unknown as SmartDigestDeliveryReconciliationStore,
      }),
    ).resolves.toMatchObject({ emailStatus: "PENDING", status: "SKIPPED" })

    expect(enqueueEmail).not.toHaveBeenCalled()
  })
})

function createStore({ emailStatus = "DELIVERY_UNKNOWN" } = {}) {
  const state = {
    digest: { emailStatus },
    run: {
      digest: { id: "digest-1" },
      emailAttempts: 1,
      emailErrorMessage: "Acknowledgement pending",
      emailStatus,
      id: "run-1",
      providerMessageId: "<provider-id@example.test>",
    },
  }
  const enqueueEmail = vi.fn().mockResolvedValue(undefined)
  const store = {
    $transaction: async (
      callback: (transaction: unknown) => Promise<unknown>,
    ) => callback(store),
    digestRun: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(state.run)),
      update: vi.fn((args) => {
        Object.assign(state.run, args.data)
        return Promise.resolve(undefined)
      }),
    },
    smartDigest: {
      update: vi.fn((args) => {
        Object.assign(state.digest, args.data)
        return Promise.resolve(undefined)
      }),
    },
  }

  return {
    enqueueEmail,
    state,
    store,
  }
}
