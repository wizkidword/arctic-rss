import { readFile } from "node:fs/promises"

import { assetManifestPath, loadAssetManifest } from "./shared"

async function main() {
  const strict = process.argv.includes("--strict")
  const statusPath = "docs/marketing/product-hunt/00-status.md"
  const status = await readFile(statusPath, "utf8")
  const manifest = await loadAssetManifest()
  const blockers: string[] = []

  if (status.includes("## Current verdict: NO-GO")) {
    blockers.push("Launch status is NO-GO.")
  }

  if (manifest.captureStatus !== "captured_pending_validation") {
    blockers.push(`Final assets are not captured (${assetManifestPath}).`)
  }

  if (process.env.PH_LAUNCH_GATE !== "GO") {
    blockers.push("PH_LAUNCH_GATE is not GO; required human/release approval is absent.")
  }

  if (blockers.length === 0) {
    console.log("Product Hunt launch readiness prerequisites are present. Run final human review before submitting.")
    return
  }

  console.log("Product Hunt launch readiness: NO-GO")
  for (const blocker of blockers) {
    console.log(`- ${blocker}`)
  }

  if (strict) {
    process.exitCode = 2
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
