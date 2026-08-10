import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const baselineCommit = "686cd18b7e7f6196865af34c93496c3bddf16a69"
const candidate = requiredOption(process.argv.slice(2), "--commit")
const candidateCommit = git(["rev-parse", `${candidate}^{commit}`]).trim()
const headCommit = git(["rev-parse", "HEAD"]).trim()
const workingTree = git(["status", "--porcelain"])

assert.equal(candidateCommit, headCommit, "The release package must name the current exact commit.")
assert.equal(workingTree, "", "The release package must be prepared from a clean working tree.")

const migrations = changedMigrationNames(candidateCommit)
for (const migration of migrations) {
  const reportPath = resolve("docs", "operations", "migration-risk", `${migration}.md`)
  assert.equal(existsSync(reportPath), true, `Missing migration risk record for ${migration}.`)
  assert.match(readFileSync(reportPath, "utf8"), /^Production ready:\s*false\s*$/mi, `${migration} must remain production-ready false.`)
}

process.stdout.write(`${JSON.stringify({
  candidateCommit,
  localEvidenceRequired: [
    "npm run migration:risk -- --base 686cd18b7e7f6196865af34c93496c3bddf16a69",
    "npm run migration:fifth-pass:verify",
    "npm test",
    "npm run redis:boundaries:verify",
    "npm run db:verify-chat-role",
    "npm run test:chat:release-gates",
    "npm run lint",
    "npm run typecheck",
  ],
  migrationRiskRecords: migrations,
  productionRelease: {
    approvalRequired: `DEPLOY ${candidateCommit.slice(0, 7)}`,
    status: "not-authorized",
  },
}, null, 2)}\n`)

function changedMigrationNames(commit) {
  return [...new Set(
    git(["diff", "--name-only", `${baselineCommit}...${commit}`, "--", "prisma/migrations"])
      .split(/\r?\n/)
      .map((file) => file.match(/^prisma\/migrations\/([^/]+)\/migration\.sql$/)?.[1])
      .filter(Boolean)
  )].sort()
}

function git(arguments_) {
  return execFileSync("git", arguments_, { encoding: "utf8", windowsHide: true })
}

function requiredOption(arguments_, name) {
  const index = arguments_.indexOf(name)
  const value = index >= 0 ? arguments_[index + 1]?.trim() : undefined
  if (!value || value.startsWith("--")) {
    throw new Error(`Use ${name} <full-commit-sha>.`)
  }
  return value
}
