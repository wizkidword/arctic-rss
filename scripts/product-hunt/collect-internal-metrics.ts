import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { productHuntRoot } from "./shared"

async function main() {
  if (process.env.PH_METRICS_AUTHORIZATION !== "CONSENTED_AGGREGATES_ONLY") {
    throw new Error(
      "Metrics collection is blocked until PH_METRICS_AUTHORIZATION=CONSENTED_AGGREGATES_ONLY is explicitly set.",
    )
  }

  const outputDirectory = path.join(productHuntRoot, "raw")
  const outputPath = path.join(outputDirectory, "launch-metrics-template.csv")
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    outputPath,
    [
      "captured_at_utc,source_channel,event_name,aggregate_count,notes",
      "YYYY-MM-DDTHH:MM:SSZ,product_hunt,guest_browse_start,,consented aggregate only",
      "YYYY-MM-DDTHH:MM:SSZ,product_hunt,signup_complete,,consented aggregate only",
      "YYYY-MM-DDTHH:MM:SSZ,product_hunt,first_feed_added,,consented aggregate only",
    ].join("\n") + "\n",
    "utf8",
  )
  console.log(`Wrote a consented-aggregate metrics template to ${outputPath}.`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
