import { describe, expect, it } from "vitest"

import {
  ExternalIrcNetworkError,
  getExternalIrcNetwork,
  isExternalIrcNetworkEnabled,
  listEnabledExternalIrcNetworks,
} from "./external-networks"

describe("external IRC network registry", () => {
  it("accepts only the owner-approved, fixed network targets", () => {
    expect(getExternalIrcNetwork("oftc")).toMatchObject({
      connectionMode: "NETWORK_OPERATED_WEBIRC",
      host: "webirc.oftc.net",
      ownerOnly: true,
      port: 8443,
    })
    expect(getExternalIrcNetwork("libera")).toMatchObject({
      host: "irc.libera.chat",
      port: 6697,
      tlsRequired: true,
    })
    expect(() => getExternalIrcNetwork("example.invalid")).toThrow(ExternalIrcNetworkError)
  })

  it("requires both global and network-specific opt-in", () => {
    expect(isExternalIrcNetworkEnabled("oftc", {})).toBe(false)
    expect(isExternalIrcNetworkEnabled("oftc", {
      ARCTIC_IRC_ENABLED: "true",
      ARCTIC_IRC_EXTERNAL_ENABLED: "true",
    })).toBe(false)
    expect(listEnabledExternalIrcNetworks({
      ARCTIC_IRC_ENABLED: "true",
      ARCTIC_IRC_EXTERNAL_ENABLED: "true",
      ARCTIC_IRC_EXTERNAL_OFTC_ENABLED: "true",
    }).map((network) => network.id)).toEqual(["oftc"])
  })
})
