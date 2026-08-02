import { describe, expect, it } from "vitest"

import { assertTopologyManifest, readTopologyManifest, resolveTopology } from "./topology-manifest.mjs"

describe("topology manifest", () => {
  it("assigns every enabled responsibility to one worker model", () => {
    const manifest = readTopologyManifest()

    for (const topologyName of Object.keys(manifest.topologies)) {
      const topology = resolveTopology(manifest, topologyName)
      const workers = manifest.workerServices.filter((service) => topology.requiredServices.includes(service))

      expect(workers.length).toBeGreaterThan(0)
      expect(workers.includes("worker") && workers.length > 1).toBe(false)
      expect(topology.requiredServices).toContain("web")
      expect(topology.requiredServices).toContain("migrate")
    }
  })

  it("enables chat only with its gateway, proxy, token, and chat-event owner", () => {
    const manifest = readTopologyManifest()
    const split = resolveTopology(manifest, "split")
    const splitWithChat = resolveTopology(manifest, "split-with-chat")

    expect(split.requiredServices).not.toContain("worker-chat-events")
    expect(splitWithChat.requiredServices).toContain("worker-chat-events")
    expect(splitWithChat.requiredServices).toContain("chat-gateway")
    expect(splitWithChat.requiredServices).toContain("edge-proxy")
    expect(splitWithChat.requiredEnvironment).toContain("ARCTIC_IRC_TOKEN_SECRET")
  })

  it("rejects simultaneous all-in-one and split worker ownership", () => {
    const manifest = readTopologyManifest()
    const invalid = structuredClone(manifest)
    invalid.topologies.split.requiredServices.push("worker")

    expect(() => assertTopologyManifest(invalid)).toThrow("worker mode all with split workers")
  })

  it("treats the tunnel as an explicit overlay", () => {
    const manifest = readTopologyManifest()
    const topology = resolveTopology(manifest, "all-in-one", { tunnel: true })

    expect(topology.profiles).toContain("tunnel")
    expect(topology.requiredServices).toContain("cloudflared")
    expect(topology.requiredEnvironment).toContain("CLOUDFLARE_TUNNEL_TOKEN")
  })
})
