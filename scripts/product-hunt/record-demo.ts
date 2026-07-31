import { execFile } from "node:child_process"
import { mkdir, rename, rm } from "node:fs/promises"
import { promisify } from "node:util"

import { chromium, type Page } from "playwright"

import { assetPath, requireApprovedCapture } from "./shared"

const run = promisify(execFile)
const demoDirectory = assetPath("marketing/product-hunt/demo")
const rawDirectory = assetPath("marketing/product-hunt/raw")
const rawVideoPath = assetPath("marketing/product-hunt/raw/arctic-rss-demo.webm")
const demoVideoPath = assetPath("marketing/product-hunt/demo/demo-master.mp4")
const youtubeThumbnailPath = assetPath("marketing/product-hunt/demo/youtube-thumbnail.png")

async function waitForScene(page: Page, milliseconds: number) {
  await page.waitForTimeout(milliseconds)
}

async function recordDemo(origin: string, page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "necessary", updatedAt: new Date().toISOString() }),
    )
  })

  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await waitForScene(page, 4_000)

  const guestLink = page.getByRole("link", { name: "Browse as Guest" }).first()
  if ((await guestLink.count()) !== 1) {
    throw new Error("The homepage guest CTA is unavailable. Do not record a misleading launch demo.")
  }

  await guestLink.click()
  await page.waitForURL(new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/guest`))
  await waitForScene(page, 8_000)

  await page.goto(new URL("/guest/discover", origin).toString(), { waitUntil: "domcontentloaded" })
  await waitForScene(page, 8_000)

  await page.goto(new URL("/guest", origin).toString(), { waitUntil: "domcontentloaded" })
  const articleLinks = page.locator('a[href*="articleId="]')
  if ((await articleLinks.count()) === 0) {
    throw new Error("Guest reader has no public article. Do not record a misleading launch demo.")
  }

  const articleHref = await articleLinks.first().getAttribute("href")
  if (!articleHref) {
    throw new Error("Guest article has no destination. Do not record a misleading launch demo.")
  }

  await page.goto(new URL(articleHref, origin).toString(), { waitUntil: "domcontentloaded" })
  const cardLayout = page.getByRole("button", { name: "Card" })
  if (await cardLayout.isVisible()) {
    await cardLayout.click()
  }
  await waitForScene(page, 10_000)

  await page.goto(new URL("/guest/podcasts/discover", origin).toString(), {
    waitUntil: "domcontentloaded",
  })
  await waitForScene(page, 8_000)

  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await waitForScene(page, 10_000)
}

async function renderDeliverables() {
  const captionsFilter = [
    "subtitles=marketing/product-hunt/demo/demo-captions.srt",
    "force_style='FontName=Arial,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=40'",
  ].join(":")

  await run("ffmpeg", [
    "-y",
    "-i",
    rawVideoPath,
    "-vf",
    captionsFilter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    demoVideoPath,
  ])

  await run("ffmpeg", [
    "-y",
    "-i",
    assetPath("marketing/product-hunt/gallery/01-calm-open-web.png"),
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xf4fbff",
    "-frames:v",
    "1",
    youtubeThumbnailPath,
  ])
}

async function main() {
  const origin = requireApprovedCapture()
  await mkdir(demoDirectory, { recursive: true })
  await mkdir(rawDirectory, { recursive: true })
  await rm(rawVideoPath, { force: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    recordVideo: { dir: rawDirectory, size: { height: 1080, width: 1920 } },
    viewport: { height: 1080, width: 1920 },
  })
  const page = await context.newPage()
  const video = page.video()

  try {
    await recordDemo(origin, page)
  } finally {
    await context.close()
    await browser.close()
  }

  if (!video) {
    throw new Error("Playwright did not create the demo recording.")
  }

  await rename(await video.path(), rawVideoPath)

  try {
    await renderDeliverables()
  } finally {
    await rm(rawVideoPath, { force: true })
  }

  console.log(`Recorded captioned Product Hunt demo from ${origin}.`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
