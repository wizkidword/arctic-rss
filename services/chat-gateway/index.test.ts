import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import {
  createProductionChatGateway,
  getChatGatewayAbuseSettings,
  getChatGatewayPort,
  getChatGatewayRecoverySettings,
} from "./index"

describe("production chat gateway configuration", () => {
  it("does not initialize the service while chat is disabled", async () => {
    await expect(
      createProductionChatGateway({ ARCTIC_IRC_ENABLED: "false" })
    ).rejects.toThrow("Arctic IRC is disabled.")
  })

  it("uses safe bounded defaults and rejects invalid recovery configuration", () => {
    expect(getChatGatewayPort({})).toBe(3001)
    expect(getChatGatewayRecoverySettings({})).toEqual({
      authorizationMaxAgeSeconds: 60,
      redisDegradedGraceSeconds: 90,
    })
    expect(() => getChatGatewayPort({ CHAT_GATEWAY_PORT: "0" })).toThrow(
      "valid TCP port"
    )
    expect(() =>
      getChatGatewayRecoverySettings({ ARCTIC_IRC_AUTHORIZATION_MAX_AGE_SECONDS: "301" })
    ).toThrow("ARCTIC_IRC_AUTHORIZATION_MAX_AGE_SECONDS")
    expect(getChatGatewayAbuseSettings({})).toMatchObject({
      maxActiveSocketsPerIp: 20,
      maxActiveSocketsPerUser: 5,
      maxEventPayloadBytes: 65_536,
      maxMalformedEvents: 5,
      maxOutstandingOperations: 8,
      maxRoomsPerSocket: 20,
    })
    expect(() =>
      getChatGatewayAbuseSettings({ ARCTIC_IRC_MAX_SOCKETS_PER_USER: "21" })
    ).toThrow("ARCTIC_IRC_MAX_SOCKETS_PER_USER")
  })

  it("connects Redis before attaching the Socket.IO Redis adapter", async () => {
    const source = await readFile("services/chat-gateway/index.ts", "utf8")

    expect(source.indexOf("await recovery.start()")).toBeLessThan(
      source.indexOf("gateway = createChatGateway(")
    )
  })
})
