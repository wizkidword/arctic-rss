import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"

import { afterEach, describe, expect, it } from "vitest"

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => close(server)))
})

describe("Compose chat release gate assertion", () => {
  it("runs the full Compose chat topology with the restricted database role", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8")

    expect(workflow).toContain(
      "CHAT_DATABASE_URL=postgresql://arctic_chat:ci-chat-runtime-password@postgres:5432/arctic_rss?schema=public"
    )
    expect(workflow).toContain("Bootstrap restricted chat runtime role after migrations")
    expect(workflow).toContain("-v chat_role=arctic_chat")
    expect(workflow).toContain("-v chat_password=ci-chat-runtime-password")
    expect(workflow.indexOf("Bootstrap restricted chat runtime role after migrations")).toBeLessThan(
      workflow.indexOf("Start the selected web, worker, and restricted chat topology")
    )
  })

  it("sends the canonical Host header while probing the loopback web service", async () => {
    const web = createServer((request, response) => {
      if (request.headers.host !== "arcticrss.test") {
        response.writeHead(400)
        response.end("Invalid host.")
        return
      }

      response.writeHead(200, {
        "content-security-policy": "script-src 'nonce-gate' 'strict-dynamic'; report-uri /api/csp-report",
      })
      response.end("ok")
    })
    const gateway = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ status: "ok" }))
    })
    const [webPort, gatewayPort] = await Promise.all([listen(web), listen(gateway)])

    await expect(runGate({ CHAT_GATEWAY_PORT: String(gatewayPort), WEB_PORT: String(webPort) })).resolves.toEqual({
      code: 0,
      stderr: "",
    })
  })
})

async function listen(server: Server) {
  servers.push(server)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP listener.")
  }

  return address.port
}

async function close(server: Server) {
  server.close()
  await once(server, "close")
}

function runGate(environment: Record<string, string>) {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/ci/assert-compose-chat-release-gates.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      stdio: ["ignore", "ignore", "pipe"],
    })
    let stderr = ""

    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })
    child.once("error", reject)
    child.once("exit", (code) => {
      resolve({ code, stderr })
    })
  })
}
