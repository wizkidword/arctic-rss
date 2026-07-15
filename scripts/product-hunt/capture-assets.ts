import { chromium, type Page } from "playwright"

import {
  assetPath,
  ensureAssetDirectories,
  loadAssetManifest,
  recordAsset,
  requireApprovedCapture,
  sourceUrl,
  writeAssetManifest,
} from "./shared"

const galleryCaptures = [
  {
    file: "marketing/product-hunt/gallery/01-calm-open-web.png",
    pathname: "/",
  },
  {
    file: "marketing/product-hunt/gallery/02-browse-without-account.png",
    pathname: "/guest",
  },
  {
    file: "marketing/product-hunt/gallery/03-discover-your-sources.png",
    pathname: "/guest/discover",
  },
  {
    file: "marketing/product-hunt/gallery/05-discover-podcasts.png",
    pathname: "/guest/podcasts/discover",
  },
] as const

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "necessary", updatedAt: new Date().toISOString() }),
    )
  })
}

async function capturePage(page: Page, origin: string, pathname: string, file: string) {
  await page.goto(sourceUrl(origin, pathname), { waitUntil: "networkidle" })
  await page.screenshot({ path: assetPath(file) })
}

async function main() {
  const origin = requireApprovedCapture()
  await ensureAssetDirectories()

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1270, height: 760 } })

  try {
    await preparePage(page)

    for (const capture of galleryCaptures) {
      await capturePage(page, origin, capture.pathname, capture.file)
    }

    await page.goto(sourceUrl(origin, "/guest"), { waitUntil: "networkidle" })
    const articleLinks = page.locator('a[href*="articleId="]')

    if ((await articleLinks.count()) === 0) {
      throw new Error("Guest reader had no selectable article. Do not capture misleading launch assets.")
    }

    const articleHref = await articleLinks.first().getAttribute("href")

    if (!articleHref) {
      throw new Error("Guest reader article has no destination. Do not capture misleading launch assets.")
    }

    await page.goto(new URL(articleHref, origin).toString(), { waitUntil: "networkidle" })

    const cardLayout = page.getByRole("button", { name: "Card" })
    if (await cardLayout.isVisible()) {
      await cardLayout.click()
    }

    await page.screenshot({
      path: assetPath("marketing/product-hunt/gallery/04-read-your-way.png"),
    })
  } finally {
    await browser.close()
  }

  const manifest = await loadAssetManifest()

  for (const capture of [
    ...galleryCaptures,
    { file: "marketing/product-hunt/gallery/04-read-your-way.png" },
  ]) {
    await recordAsset(manifest, capture.file)
  }

  manifest.captureStatus = "captured_pending_validation"
  await writeAssetManifest(manifest)
  console.log(`Captured ${galleryCaptures.length + 1} Product Hunt gallery assets from ${origin}.`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
