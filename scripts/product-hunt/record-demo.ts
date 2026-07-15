import { access } from "node:fs/promises"

import { assetPath, requireApprovedCapture } from "./shared"

async function main() {
  const origin = requireApprovedCapture()
  await access(assetPath("docs/marketing/product-hunt/06-demo-script.md"))

  throw new Error(
    [
      `Demo recording is intentionally manual after approval. Use ${origin} with only public/demo data.`,
      "Record the caption-led shot list in docs/marketing/product-hunt/06-demo-script.md.",
      "Export 1920×1080 H.264 MP4 with fast-start metadata, then add human-reviewed captions and transcript.",
      "Upload through the maker’s own YouTube account, keep the video public/unlisted only when Product Hunt accepts it, and verify logged-out playback before adding its full URL.",
    ].join("\n"),
  )
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
