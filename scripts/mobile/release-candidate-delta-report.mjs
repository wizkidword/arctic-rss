#!/usr/bin/env node

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const candidate = JSON.parse(await readFile(join(root, "docs", "mobile", "release-candidate.json"), "utf8"))
const files = execFileSync("git", ["diff", "--name-only", candidate.sourceCommit], {
  cwd: root,
  encoding: "utf8",
}).split("\n").filter(Boolean)

const categories = Object.fromEntries([
  "native-runtime",
  "shared-api-contract",
  "server-mobile-api",
  "authentication",
  "app-links",
  "build-configuration",
  "documentation-only",
  "operations-only",
  "other",
].map((category) => [category, []]))

for (const file of files) {
  categories[classify(file)].push(file)
}

const supersedingCategories = [
  "native-runtime",
  "shared-api-contract",
  "server-mobile-api",
  "authentication",
  "app-links",
  "build-configuration",
]
const superseded = supersedingCategories.some((category) => categories[category].length > 0)
assert.equal(candidate.candidateStatus, superseded ? "SUPERSEDED" : "CURRENT", "Candidate status disagrees with the source delta.")
process.stdout.write(`${JSON.stringify({
  candidateStatus: candidate.candidateStatus,
  changedFileCount: files.length,
  categories,
  superseded,
}, null, 2)}\n`)

function classify(file) {
  if (/^(apps\/mobile\/src\/|apps\/mobile\/app\/)/.test(file)) return "native-runtime"
  if (/^(packages\/mobile-client\/|docs\/mobile\/openapi-v1\.json)/.test(file)) return "shared-api-contract"
  if (/^src\/app\/api\/(mobile|v1)\//.test(file) || /^src\/lib\/mobile-(sync|telemetry)/.test(file)) return "server-mobile-api"
  if (/^src\/(auth\.ts|lib\/(authorization|mobile-auth|password))/.test(file)) return "authentication"
  if (/^(public\/\.well-known\/assetlinks\.json|apps\/mobile\/(app\.json|app\.config\.cjs))/.test(file)) return "app-links"
  if (/^(apps\/mobile\/eas\.json|apps\/mobile\/package\.json|package\.json|package-lock\.json)/.test(file)) return "build-configuration"
  if (/^docs\//.test(file)) return "documentation-only"
  if (/^(ops\/|scripts\/windows\/|docker-compose|Dockerfile)/.test(file)) return "operations-only"
  return "other"
}
