import { describe, expect, it } from "vitest"

import {
  ExternalIrcEgressError,
  isPublicIrcEgressAddress,
  resolveApprovedExternalIrcTarget,
} from "./external-egress"

describe("external IRC egress guard", () => {
  it("rejects loopback, private, shared, documentation, and malformed addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "100.64.0.1", "172.20.0.1", "192.168.0.1", "198.18.0.1", "::1", "fc00::1", "2001:db8::1", "not-an-ip"]) {
      expect(isPublicIrcEgressAddress(address)).toBe(false)
    }
    expect(isPublicIrcEgressAddress("1.1.1.1")).toBe(true)
  })

  it("resolves only a registry host and fails closed when any result is unsafe", async () => {
    await expect(resolveApprovedExternalIrcTarget({
      networkId: "oftc",
      resolve: async (host) => {
        expect(host).toBe("webirc.oftc.net")
        return ["1.1.1.1"]
      },
    })).resolves.toMatchObject({ addresses: ["1.1.1.1"], port: 8443 })

    await expect(resolveApprovedExternalIrcTarget({
      networkId: "libera",
      resolve: async () => ["1.1.1.1", "127.0.0.1"],
    })).rejects.toBeInstanceOf(ExternalIrcEgressError)
  })
})
