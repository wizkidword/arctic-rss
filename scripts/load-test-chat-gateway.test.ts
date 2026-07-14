import { describe, expect, it } from "vitest"

import {
  getChatGatewayLoadTestConfig,
  summarizeChatGatewayLoadTest,
} from "./load-test-chat-gateway"

describe("chat gateway load-test guardrails", () => {
  it("requires explicit confirmation and defaults to the loopback readiness endpoint", () => {
    expect(() => getChatGatewayLoadTestConfig({})).toThrow("ARCTIC_IRC_LOAD_TEST_CONFIRM")
    expect(
      getChatGatewayLoadTestConfig({ ARCTIC_IRC_LOAD_TEST_CONFIRM: "loopback-only" })
    ).toMatchObject({
      concurrency: 10,
      durationMs: 30_000,
      target: new URL("http://127.0.0.1:3001/ready"),
    })
  })

  it("refuses non-loopback and out-of-range load-test targets", () => {
    expect(() =>
      getChatGatewayLoadTestConfig({
        ARCTIC_IRC_LOAD_TEST_CONFIRM: "loopback-only",
        ARCTIC_IRC_LOAD_TEST_URL: "https://arcticrss.example/ready",
      })
    ).toThrow("loopback")
    expect(() =>
      getChatGatewayLoadTestConfig({
        ARCTIC_IRC_LOAD_TEST_CONCURRENCY: "101",
        ARCTIC_IRC_LOAD_TEST_CONFIRM: "loopback-only",
      })
    ).toThrow("1 to 100")
  })

  it("reports deterministic request and latency summaries", () => {
    const summary = summarizeChatGatewayLoadTest({
      failed: 1,
      latencySamples: [20, 10, 40, 30],
      statusCounts: new Map([
        ["200", 3],
        ["503", 1],
      ]),
      succeeded: 3,
    })

    expect(summary).toEqual({
      failed: 1,
      p50Ms: 20,
      p95Ms: 40,
      requests: 4,
      statusCounts: { 200: 3, 503: 1 },
      succeeded: 3,
    })
  })
})
