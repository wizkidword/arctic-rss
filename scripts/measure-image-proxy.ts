import { performance } from "node:perf_hooks"

import sharp from "sharp"

import {
  IMAGE_PROXY_MAX_PIXELS,
  reencodeProxiedImage,
} from "../src/lib/image-proxy"

async function main() {
  const sideLength = Math.sqrt(IMAGE_PROXY_MAX_PIXELS)
  const input = await sharp({
    create: {
      background: { alpha: 1, b: 48, g: 32, r: 16 },
      channels: 4,
      height: sideLength,
      width: sideLength,
    },
  })
    .png()
    .toBuffer()
  const before = memorySnapshot()
  let peak = before
  const sampler = setInterval(() => {
    const current = memorySnapshot()

    peak = {
      arrayBuffers: Math.max(peak.arrayBuffers, current.arrayBuffers),
      external: Math.max(peak.external, current.external),
      heapUsed: Math.max(peak.heapUsed, current.heapUsed),
      rss: Math.max(peak.rss, current.rss),
    }
  }, 10)
  const startedAt = performance.now()
  let output: Awaited<ReturnType<typeof reencodeProxiedImage>>

  try {
    output = await reencodeProxiedImage(input)
  } finally {
    clearInterval(sampler)
  }

  const elapsedMs = performance.now() - startedAt
  const after = memorySnapshot()
  const memoryDeltaBytes = {
    arrayBuffers: after.arrayBuffers - before.arrayBuffers,
    external: after.external - before.external,
    heapUsed: after.heapUsed - before.heapUsed,
    rss: after.rss - before.rss,
  }
  const peakMemoryDeltaBytes = {
    arrayBuffers: peak.arrayBuffers - before.arrayBuffers,
    external: peak.external - before.external,
    heapUsed: peak.heapUsed - before.heapUsed,
    rss: peak.rss - before.rss,
  }

  console.log(
    JSON.stringify(
      {
        elapsedMs: Math.round(elapsedMs),
        inputBytes: input.byteLength,
        maxDecodedPixels: IMAGE_PROXY_MAX_PIXELS,
        memoryDeltaBytes,
        peakMemoryDeltaBytes,
        outputBytes: output.bytes.byteLength,
      },
      null,
      2
    )
  )
}

function memorySnapshot() {
  const { arrayBuffers, external, heapUsed, rss } = process.memoryUsage()

  return { arrayBuffers, external, heapUsed, rss }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
