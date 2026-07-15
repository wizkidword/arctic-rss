import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"

import { assetPath, loadAssetManifest } from "./shared"

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

async function inspectPng(relativePath: string) {
  const filePath = assetPath(relativePath)
  const [contents, fileStat] = await Promise.all([readFile(filePath), stat(filePath)])

  if (!contents.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error(`${relativePath} is not a PNG file.`)
  }

  return {
    byteSize: fileStat.size,
    checksumSha256: createHash("sha256").update(contents).digest("hex"),
    height: contents.readUInt32BE(20),
    width: contents.readUInt32BE(16),
  }
}

async function main() {
  const manifest = await loadAssetManifest()

  if (manifest.captureStatus !== "captured_pending_validation") {
    throw new Error(
      "Asset manifest is not ready for validation. Capture final approved assets first; provisional screenshots are not launch assets.",
    )
  }

  if (manifest.assets.filter((asset) => asset.path.includes("/gallery/")).length < 4) {
    throw new Error("At least four gallery assets are required.")
  }

  for (const asset of manifest.assets) {
    const inspected = await inspectPng(asset.path)

    if (inspected.width !== asset.width || inspected.height !== asset.height) {
      throw new Error(
        `${asset.path} is ${inspected.width}×${inspected.height}; expected ${asset.width}×${asset.height}.`,
      )
    }

    if (asset.path.includes("/thumbnail/") && inspected.byteSize >= 3 * 1024 * 1024) {
      throw new Error(`${asset.path} must be smaller than 3 MB.`)
    }

    if (!asset.checksumSha256 || asset.checksumSha256 !== inspected.checksumSha256) {
      throw new Error(`${asset.path} checksum does not match asset-manifest.json.`)
    }

    if (asset.byteSize !== inspected.byteSize) {
      throw new Error(`${asset.path} byte size does not match asset-manifest.json.`)
    }
  }

  console.log(`Validated ${manifest.assets.length} Product Hunt assets.`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
