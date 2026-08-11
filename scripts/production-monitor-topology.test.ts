import { execFileSync } from "node:child_process"
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { readTopologyManifest } from "../ops/topology-manifest.mjs"

const runOnBashHosts = process.platform === "win32" ? it.skip : it

describe("production monitor topology resolver", () => {
  runOnBashHosts("derives every supported topology from the active release record", async () => {
    const manifest = readTopologyManifest()
    const topologies = manifest.topologies as Record<
      string,
      { chatEnabled: boolean; requiredHealthServices: string[] }
    >

    for (const [topologyName, topology] of Object.entries(topologies)) {
      const composeProject = topologyName === "split-with-chat" ? "arctic-qa" : "app"
      const output = await resolveTopologyFixture(topologyName, composeProject)

      expect(output.composeProject).toBe(composeProject)
      expect(output.topology).toBe(topologyName)
      expect(output.chatEnabled).toBe(topology.chatEnabled)
      expect(output.edgeProxyEnabled).toBe(topology.requiredHealthServices.includes("edge-proxy"))
      expect(output.requiredServices).toEqual(topology.requiredHealthServices)
      expect(output.requiredWorkerModes).toEqual(
        topology.requiredHealthServices.filter((service: string) => manifest.workerServices.includes(service))
      )
    }
  })

  runOnBashHosts("retains the monitored Compose default for a pre-monitor release marker", async () => {
    const output = await resolveTopologyFixture("all-in-one", undefined)

    expect(output.composeProject).toBe("app")
  })

  runOnBashHosts("fails closed for a release topology absent from the manifest", async () => {
    await expect(resolveTopologyFixture("retired-topology", "app")).rejects.toThrow(
      "active release topology is not defined"
    )
  })
})

async function resolveTopologyFixture(topology: string, composeProject: string | undefined) {
  const appDirectory = await mkdtemp(join(tmpdir(), "arctic-rss-monitor-topology-"))

  try {
    await mkdir(join(appDirectory, "ops"), { recursive: true })
    await cp("ops/topologies.json", join(appDirectory, "ops", "topologies.json"), { recursive: true })
    await writeFile(
      join(appDirectory, ".arctic-rss-release.json"),
      `${JSON.stringify({ schemaVersion: 1, topology, ...(composeProject ? { composeProject } : {}) })}\n`,
      "utf8"
    )

    let stdout: string
    try {
      stdout = execFileSync("bash", [resolve("scripts/production-monitor-topology.sh")], {
        encoding: "utf8",
        env: { ...process.env, APP_DIR: appDirectory, COMPOSE_PROJECT: "app" },
      })
    } catch (error) {
      const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : ""
      throw new Error(stderr.trim() || "The monitor topology resolver failed.")
    }

    return parseTopologyOutput(stdout)
  } finally {
    await rm(appDirectory, { force: true, recursive: true })
  }
}

function parseTopologyOutput(stdout: string) {
  const output = {
    chatEnabled: false,
    composeProject: "",
    edgeProxyEnabled: false,
    requiredServices: [] as string[],
    requiredWorkerModes: [] as string[],
    topology: "",
  }

  for (const line of stdout.trim().split(/\r?\n/)) {
    const [key, value] = line.split("=", 2)

    switch (key) {
      case "compose_project":
        output.composeProject = value
        break
      case "topology":
        output.topology = value
        break
      case "chat_enabled":
        output.chatEnabled = value === "true"
        break
      case "edge_proxy_enabled":
        output.edgeProxyEnabled = value === "true"
        break
      case "required_service":
        output.requiredServices.push(value)
        break
      case "required_worker_mode":
        output.requiredWorkerModes.push(value)
        break
      default:
        throw new Error(`Unknown monitor topology output: ${line}`)
    }
  }

  return output
}
