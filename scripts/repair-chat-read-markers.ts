import { getPrisma } from "../src/lib/db"
import { repairChatReadMarkers } from "../src/lib/chat/read-marker-repair"

const BATCH_SIZE = 100

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  if (!dryRun && process.env.ARCTIC_IRC_REPAIR_READ_MARKERS_CONFIRM !== "REPAIR") {
    throw new Error(
      "Set ARCTIC_IRC_REPAIR_READ_MARKERS_CONFIRM=REPAIR or pass --dry-run."
    )
  }

  const store = getPrisma()
  let afterId: string | undefined
  let clamped = 0
  let scanned = 0

  do {
    const result = await repairChatReadMarkers({
      afterId,
      batchSize: BATCH_SIZE,
      dryRun,
      store,
    })
    afterId = result.nextCursor ?? undefined
    clamped += result.clamped
    scanned += result.scanned
  } while (afterId)

  console.log(
    JSON.stringify({
      clamped,
      dryRun,
      event: "chat_read_marker_repair_complete",
      scanned,
    })
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Chat read-marker repair failed.")
  process.exitCode = 1
})
