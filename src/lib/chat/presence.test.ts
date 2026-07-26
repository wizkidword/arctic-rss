import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CHAT_PRESENCE_HEARTBEAT_INTERVAL_MS,
  clearChatPresence,
  createChatPresenceHeartbeat,
  createChatPresenceTelemetry,
  markChatPresence,
  refreshChatPresence,
} from "./presence"

describe("chat presence", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("tracks each room connection with a bounded Redis TTL", async () => {
    const store = { del: vi.fn(), set: vi.fn().mockResolvedValue("OK") }
    const input = {
      connectionId: "socket-1",
      roomId: "room-1",
      userId: "user-1",
    }

    await markChatPresence(input, store)
    await clearChatPresence(input, store)

    expect(store.set).toHaveBeenCalledWith(
      "arctic-rss:chat:presence:v1:room-1:user-1:socket-1",
      "1",
      "EX",
      75
    )
    expect(store.del).toHaveBeenCalledWith(
      "arctic-rss:chat:presence:v1:room-1:user-1:socket-1"
    )
  })

  it("renews only active socket subscriptions with one heartbeat for several TTL periods", async () => {
    vi.useFakeTimers()
    const roomIds = new Set(["room-1", "room-2"])
    const refresh = vi.fn().mockResolvedValue(undefined)
    const heartbeat = createChatPresenceHeartbeat({
      connectionId: "socket-1",
      getRoomIds: () => roomIds,
      intervalMs: 10,
      refresh,
      userId: "user-1",
    })

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(30)
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(refresh).toHaveBeenLastCalledWith([
      { connectionId: "socket-1", roomId: "room-1", userId: "user-1" },
      { connectionId: "socket-1", roomId: "room-2", userId: "user-1" },
    ])

    roomIds.delete("room-1")
    await vi.advanceTimersByTimeAsync(10)
    expect(refresh).toHaveBeenLastCalledWith([
      { connectionId: "socket-1", roomId: "room-2", userId: "user-1" },
    ])

    heartbeat.stop()
    await vi.advanceTimersByTimeAsync(40)
    expect(refresh).toHaveBeenCalledTimes(4)
    expect(CHAT_PRESENCE_HEARTBEAT_INTERVAL_MS * 2).toBeLessThanOrEqual(75_000)
  })

  it("records failed renewals and keeps later heartbeat attempts available", async () => {
    vi.useFakeTimers()
    const failure = vi.fn()
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("redis unavailable"))
      .mockResolvedValueOnce(undefined)
    const heartbeat = createChatPresenceHeartbeat({
      connectionId: "socket-1",
      getRoomIds: () => ["room-1"],
      intervalMs: 10,
      onRefreshFailure: failure,
      refresh,
      userId: "user-1",
    })

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(20)
    heartbeat.stop()

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it("publishes bounded local subscription, refresh-failure, and cleanup metrics", () => {
    const updates = vi.fn()
    const telemetry = createChatPresenceTelemetry(updates)

    telemetry.recordSubscriptionAdded()
    telemetry.recordSubscriptionAdded()
    telemetry.recordSubscriptionRemoved()
    telemetry.recordRefreshFailure()
    telemetry.recordCleanup(3)

    expect(telemetry.snapshot()).toEqual({
      activePresenceEntries: 1,
      activeSubscriptions: 1,
      presenceRefreshFailures: 1,
      stalePresenceCleanup: 3,
    })
    expect(updates).toHaveBeenCalledTimes(5)
  })

  it("refreshes each presence entry with the normal TTL", async () => {
    const store = { del: vi.fn(), set: vi.fn().mockResolvedValue("OK") }

    await refreshChatPresence(
      [
        { connectionId: "socket-1", roomId: "room-1", userId: "user-1" },
        { connectionId: "socket-1", roomId: "room-2", userId: "user-1" },
      ],
      store
    )

    expect(store.set).toHaveBeenCalledTimes(2)
  })
})
