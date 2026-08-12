import { readFile } from "node:fs/promises"

import {
  evaluateSameDayBackupPruning,
  type BackupPruneRecord,
} from "../src/lib/backup-pruning"

const [inputPath, maximumPerDay] = process.argv.slice(2)
if (!inputPath || !maximumPerDay || process.argv.length !== 4) {
  throw new Error("Usage: tsx scripts/report-backup-pruning.ts <catalog.json> <maximum-backups-per-day>")
}
if (!/^[1-9]\d*$/.test(maximumPerDay)) {
  throw new Error("Maximum backups per day must be a positive whole number.")
}

const parsed = JSON.parse(await readFile(inputPath, "utf8"))
if (!Array.isArray(parsed)) {
  throw new Error("Backup prune catalog must be a JSON array.")
}

const decisions = evaluateSameDayBackupPruning(parsed as BackupPruneRecord[], {
  maximumBackupsPerDay: Number(maximumPerDay),
})
process.stdout.write(`${JSON.stringify({ mode: "dry-run", decisions }, null, 2)}\n`)
