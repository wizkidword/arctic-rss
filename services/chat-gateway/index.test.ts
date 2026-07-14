import { describe, expect, it } from "vitest"

import { createProductionChatGateway, getChatGatewayPort } from "./index"

describe("production chat gateway configuration", () => {
  it("does not initialize the service while chat is disabled", async () => {
    await expect(
      createProductionChatGateway({ ARCTIC_IRC_ENABLED: "false" })
    ).rejects.toThrow("Arctic IRC is disabled.")
  })

  it("uses a safe default port and rejects invalid port configuration", () => {
    expect(getChatGatewayPort({})).toBe(3001)
    expect(() => getChatGatewayPort({ CHAT_GATEWAY_PORT: "0" })).toThrow(
      "valid TCP port"
    )
  })
})
