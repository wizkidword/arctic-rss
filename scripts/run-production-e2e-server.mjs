import { cp, stat } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { spawn } from "node:child_process"

const workspaceRoot = process.cwd()
const standaloneRoot = path.join(workspaceRoot, ".next", "standalone")

await copyDirectoryIfPresent(
  path.join(workspaceRoot, ".next", "static"),
  path.join(standaloneRoot, ".next", "static")
)
await copyDirectoryIfPresent(
  path.join(workspaceRoot, "public"),
  path.join(standaloneRoot, "public")
)

const serverArguments = [path.join(standaloneRoot, "server.js")]

if (process.env.ARCTIC_RSS_E2E_FIXTURES === "1") {
  serverArguments.unshift(
    "--require",
    path.join(workspaceRoot, "scripts", "e2e", "feed-fixture-network.cjs")
  )
}

const server = spawn(process.execPath, serverArguments, {
  cwd: standaloneRoot,
  env: process.env,
  stdio: "inherit",
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.kill(signal)
  })
}

const exitCode = await new Promise((resolve) => {
  server.once("exit", (code) => resolve(code ?? 1))
})

process.exitCode = Number(exitCode) || 1

async function copyDirectoryIfPresent(source, destination) {
  try {
    await stat(source)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return
    }

    throw error
  }

  await cp(source, destination, { force: true, recursive: true })
}
