import { readFile } from "node:fs/promises"

import { chromium } from "playwright"

import {
  assetPath,
  ensureAssetDirectories,
  loadAssetManifest,
  recordAsset,
  requireApprovedCapture,
  writeAssetManifest,
} from "./shared"

function brandMarkup(iconDataUrl: string, compact: boolean) {
  const titleSize = compact ? 38 : 96
  const subtitleSize = compact ? 0 : 38

  return `<!doctype html>
<html><body style="margin:0;background:#eaf6ff;color:#071828;font-family:Arial,sans-serif;overflow:hidden">
  <main style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 80% 20%,#bae6fd 0,transparent 38%),linear-gradient(135deg,#f8fdff,#e0f2fe)">
    <section style="display:flex;align-items:center;gap:${compact ? 14 : 32}px;text-align:left">
      <img src="${iconDataUrl}" alt="Arctic RSS" style="width:${compact ? 90 : 190}px;height:${compact ? 90 : 190}px;object-fit:contain" />
      <div>
        <div style="font-size:${titleSize}px;font-weight:800;letter-spacing:-0.05em">Arctic RSS</div>
        ${subtitleSize ? `<div style="margin-top:16px;font-size:${subtitleSize}px;line-height:1.2;max-width:780px">Follow the open web without the noise.</div>` : ""}
      </div>
    </section>
  </main>
</body></html>`
}

async function screenshotCard({
  height,
  html,
  output,
  width,
}: {
  height: number
  html: string
  output: string
  width: number
}) {
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({ viewport: { height, width } })
    await page.setContent(html, { waitUntil: "load" })
    await page.screenshot({ path: assetPath(output) })
  } finally {
    await browser.close()
  }
}

async function main() {
  requireApprovedCapture()
  await ensureAssetDirectories()
  const icon = await readFile(assetPath("public/brand/arctic-rss-icon.png"))
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`

  await screenshotCard({
    height: 240,
    html: brandMarkup(iconDataUrl, true),
    output: "marketing/product-hunt/thumbnail/arctic-rss-product-hunt.png",
    width: 240,
  })
  await screenshotCard({
    height: 630,
    html: brandMarkup(iconDataUrl, false),
    output: "marketing/product-hunt/social/arctic-rss-open-graph.png",
    width: 1200,
  })

  const manifest = await loadAssetManifest()
  await recordAsset(manifest, "marketing/product-hunt/thumbnail/arctic-rss-product-hunt.png")
  await recordAsset(manifest, "marketing/product-hunt/social/arctic-rss-open-graph.png")
  await writeAssetManifest(manifest)
  console.log("Rendered Product Hunt thumbnail and social card.")
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
