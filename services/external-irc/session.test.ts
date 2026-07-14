import { describe, expect, it, vi } from "vitest"

import {
  calculateReconnectDelay,
  createExternalIrcSession,
  shouldOpenReconnectCircuit,
} from "./session"

describe("controlled external IRC session", () => {
  it("uses typed IRC operations and handles ping without a raw-command escape hatch", () => {
    const writes: string[] = []
    const events: unknown[] = []
    const session = createExternalIrcSession({
      nickname: "arcticowner",
      onEvent: (event) => events.push(event),
      transport: { close: vi.fn(), write: (line) => writes.push(line) },
    })

    session.start()
    session.join("#arctic-test")
    session.sendChannelMessage("#arctic-test", "Hello from a controlled test.")
    session.receive("PING :server-token\r\n")

    expect(writes).toEqual([
      "CAP LS 302\r\n",
      "NICK arcticowner\r\n",
      "USER arctic 0 * :ArcticIRC\r\n",
      "JOIN #arctic-test\r\n",
      "PRIVMSG #arctic-test :Hello from a controlled test.\r\n",
      "PONG :server-token\r\n",
    ])
    expect(events).toContainEqual(expect.objectContaining({ type: "message" }))
  })

  it("keeps two controlled sessions isolated and bounds reconnect behavior", () => {
    const firstEvents: unknown[] = []
    const secondEvents: unknown[] = []
    const first = createExternalIrcSession({
      nickname: "firstuser",
      onEvent: (event) => firstEvents.push(event),
      transport: { close: vi.fn(), write: vi.fn() },
    })
    createExternalIrcSession({
      nickname: "seconduser",
      onEvent: (event) => secondEvents.push(event),
      transport: { close: vi.fn(), write: vi.fn() },
    })

    first.receive(":server NOTICE firstuser :only first\r\n")

    expect(firstEvents).toContainEqual(expect.objectContaining({ type: "message" }))
    expect(secondEvents).toEqual([])
    expect(calculateReconnectDelay({ attempt: 1, random: () => 0.5 })).toBe(1_000)
    expect(calculateReconnectDelay({ attempt: 20, random: () => 0.5 })).toBe(60_000)
    expect(shouldOpenReconnectCircuit({
      failures: 8,
      now: new Date("2026-07-14T00:04:00.000Z"),
      windowStartedAt: new Date("2026-07-14T00:00:00.000Z"),
    })).toBe(true)
  })
})
