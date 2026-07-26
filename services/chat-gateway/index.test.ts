import { describe, expect, it } from "vitest"

import {
  createProductionChatGateway,
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
  })
})
