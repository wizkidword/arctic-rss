import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const legacyVariablePattern =
  /(^|[^A-Z_])(REDIS_URL|ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION)([^A-Z_]|$)/m
const expectedFiles = [
  ".env.example",
  "DEPLOYMENT.md",
  "PROJECT.md",
  "config/service-role-environments.json",
  "docker-compose.yml",
  "docs/arcticirc/01-repo-audit.md",
  "docs/audits/second-pass-phase-4a-redis-separation.md",
  "docs/audits/second-pass-revalidation.md",
  "docs/audits/third-pass-implementation-baseline.md",
  "docs/operations/current-production-inventory.md",
  "docs/operations/deployment-rollback-runbook.md",
  "docs/operations/legacy-redis-compatibility-retirement.md",
  "docs/superpowers/specs/2026-06-24-production-deployment-design.md",
  "scripts/ci/assert-legacy-redis-compatibility.mjs",
  "src/lib/production-security.test.ts",
  "src/lib/production-security.ts",
  "src/lib/redis-config.test.ts",
  "src/lib/redis-config.ts",
].sort()

const candidateFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" }
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.startsWith("src/generated/"))

const actualFiles = candidateFiles
  .filter((file) => legacyVariablePattern.test(readFileSync(file, "utf8")))
  .sort()

assert.deepEqual(
  actualFiles,
  expectedFiles,
  "Legacy Redis compatibility may appear only in its documented, tested retirement boundary."
)

console.log("Legacy Redis compatibility boundary verified.")
