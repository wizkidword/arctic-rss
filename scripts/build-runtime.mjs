import { rm } from "node:fs/promises"
import { resolve } from "node:path"

import { build } from "esbuild"

const outputDirectory = resolve("build/runtime")
const buildOptions = {
  bundle: true,
  format: "esm",
  minifySyntax: true,
  minifyWhitespace: true,
  packages: "external",
  platform: "node",
  sourcemap: false,
  target: "node24",
  tsconfig: resolve("tsconfig.json"),
}

await rm(outputDirectory, { force: true, recursive: true })

await Promise.all([
  build({
    ...buildOptions,
    entryPoints: ["worker/index.ts"],
    outfile: resolve(outputDirectory, "worker.mjs"),
  }),
  build({
    ...buildOptions,
    entryPoints: ["services/chat-gateway/index.ts"],
    outfile: resolve(outputDirectory, "chat-gateway.mjs"),
  }),
  build({
    ...buildOptions,
    entryPoints: ["scripts/bootstrap-admin.ts"],
    outfile: resolve(outputDirectory, "bootstrap-admin.mjs"),
  }),
  build({
    ...buildOptions,
    entryPoints: ["scripts/repair-chat-read-markers.ts"],
    outfile: resolve(outputDirectory, "repair-chat-read-markers.mjs"),
  }),
])
