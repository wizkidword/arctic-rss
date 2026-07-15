import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

export type AssetRecord = {
  byteSize: number | null
  checksumSha256: string | null
  height: number
  path: string
  width: number
}

export type AssetManifest = {
  assets: AssetRecord[]
  captureStatus: "gated_not_captured" | "captured_pending_validation"
  product: string
  version: number
}

export const repoRoot = process.cwd()
export const productHuntRoot = path.join(repoRoot, "marketing", "product-hunt")
export const assetManifestPath = path.join(
  repoRoot,
  "docs",
  "marketing",
  "product-hunt",
  "asset-manifest.json",
)

export function assetPath(relativePath: string) {
  return path.join(repoRoot, relativePath)
}

export async function loadAssetManifest() {
  return JSON.parse(await readFile(assetManifestPath, "utf8")) as AssetManifest
}

export async function writeAssetManifest(manifest: AssetManifest) {
  await writeFile(assetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}

export async function recordAsset(manifest: AssetManifest, relativePath: string) {
  const entry = manifest.assets.find((asset) => asset.path === relativePath)

  if (!entry) {
    throw new Error(`Asset ${relativePath} is missing from asset-manifest.json.`)
  }

  const contents = await readFile(assetPath(relativePath))
  entry.byteSize = (await stat(assetPath(relativePath))).size
  entry.checksumSha256 = createHash("sha256").update(contents).digest("hex")
}

export async function ensureAssetDirectories() {
  await Promise.all([
    mkdir(path.join(productHuntRoot, "thumbnail"), { recursive: true }),
    mkdir(path.join(productHuntRoot, "gallery"), { recursive: true }),
    mkdir(path.join(productHuntRoot, "social"), { recursive: true }),
  ])
}

export function requireApprovedCapture() {
  if (process.env.PH_LAUNCH_GATE !== "GO") {
    throw new Error(
      "Final asset capture is blocked. Set PH_LAUNCH_GATE=GO only after the documented release and human gates pass.",
    )
  }

  if (process.env.PH_ASSET_CAPTURE_AUTHORIZATION !== "PUBLIC_AND_DEMO_DATA_ONLY") {
    throw new Error(
      "Final asset capture requires PH_ASSET_CAPTURE_AUTHORIZATION=PUBLIC_AND_DEMO_DATA_ONLY.",
    )
  }

  const source = process.env.PH_ASSET_SOURCE_URL

  if (!source) {
    throw new Error("Set PH_ASSET_SOURCE_URL to the approved deployed public source.")
  }

  const parsed = new URL(source)

  if (parsed.protocol !== "https:" || parsed.hostname !== "arcticrss.com") {
    throw new Error(
      "Final Product Hunt assets must be captured from the approved HTTPS canonical source https://arcticrss.com.",
    )
  }

  return parsed.origin
}

export function sourceUrl(origin: string, pathname: string) {
  return new URL(pathname, `${origin}/`).toString()
}
