import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const ledgerPath = resolve("docs/audits/fifth-pass-capability-status.md")
const expectedIds = Array.from({ length: 10 }, (_, index) => `FP-${String(index + 1).padStart(3, "0")}`)
const content = readFileSync(ledgerPath, "utf8")
const headers = content.match(/^\| Finding ID \|(.+)$/m)?.[0] ?? ""
const rows = [...content.matchAll(/^\| (FP-\d{3})\s+\|(.+)$/gm)]
const ids = rows.map(([, id]) => id)

assert.match(headers, /\| Source implementation\s+\|/, "The ledger must keep source implementation evidence.")
assert.match(headers, /\| Production release status \| Operator verification \|/, "The ledger must keep release and operator evidence independent.")
assert.deepEqual(ids, expectedIds, "The fifth-pass ledger must contain each stable finding ID exactly once and in order.")

for (const [, id, row] of rows) {
  assert.match(row, /\| Not deployed\s+\| No\s+\|/, `${id} must not be presented as production-verified without operator evidence.`)
}

process.stdout.write(`Fifth-pass capability ledger verified: ${ids.join(", ")}\n`)
