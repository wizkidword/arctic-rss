import { getPrisma } from "../src/lib/db"
import { reportSourceOrphanRetention } from "../src/lib/source-orphan-retention"

async function main() {
  const report = await reportSourceOrphanRetention({ store: getPrisma() })
  process.stdout.write(`${JSON.stringify(report)}\n`)
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Source orphan-retention report failed."}\n`
  )
  process.exitCode = 1
})
