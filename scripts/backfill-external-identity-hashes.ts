import { getPrisma } from "../src/lib/db"
import {
  assertExternalIdentityBackfillIsDisposable,
  backfillExternalIdentityHashes,
} from "../src/lib/external-identity-backfill"

async function main() {
  assertExternalIdentityBackfillIsDisposable({
    confirmation: process.env.ARCTIC_RSS_EXTERNAL_IDENTITY_HASH_BACKFILL_CONFIRM,
    databaseUrl: process.env.DATABASE_URL,
  })

  const result = await backfillExternalIdentityHashes({
    batchSize: positiveEnvironmentInteger("ARCTIC_RSS_EXTERNAL_IDENTITY_HASH_BACKFILL_BATCH_SIZE", 100),
    maxBatches: positiveEnvironmentInteger("ARCTIC_RSS_EXTERNAL_IDENTITY_HASH_BACKFILL_MAX_BATCHES", 1),
    store: getPrisma() as never,
  })

  process.stdout.write(`${JSON.stringify({ event: "external_identity_hash_backfill", ...result })}\n`)
}

function positiveEnvironmentInteger(name: string, fallback: number) {
  const value = process.env[name]?.trim()

  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : fallback
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "External identity backfill failed."}\n`)
  process.exitCode = 1
})
