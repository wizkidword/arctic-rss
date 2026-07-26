import sharp from "sharp"
import { describe, expect, it } from "vitest"

import {
  assertImageMetadata,
  ImageProxyValidationError,
  imageSignature,
  reencodeProxiedImage,
} from "./image-proxy"

describe("image proxy content validation", () => {
  it.each([
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
    [new Uint8Array([0xff, 0xd8, 0xff]), "jpeg"],
    [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), "gif"],
    [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "webp"],
    [new Uint8Array([0x42, 0x4d]), "bmp"],
    [new Uint8Array([0, 0, 1, 0]), "ico"],
    [new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]), "avif"],
  ])("recognizes an approved %s signature", (input, expected) => {
    expect(imageSignature(input)).toBe(expected)
  })

  it("rejects bytes without an approved image signature", () => {
    expect(imageSignature(new TextEncoder().encode("<svg></svg>"))).toBeNull()
  })

  it("enforces decoded-pixel and animation-frame limits from metadata", () => {
    expect(() =>
      assertImageMetadata(
        { height: 2, pages: 1, width: 3 },
        { maxAnimationFrames: 100, maxPixels: 5 }
      )
    ).toThrow(ImageProxyValidationError)

    expect(() =>
      assertImageMetadata(
        { height: 1, pages: 101, width: 1 },
        { maxAnimationFrames: 100, maxPixels: 5 }
      )
    ).toThrow("too many animation frames")
  })

  it("rejects an animated input when its actual frame count exceeds the limit", async () => {
    const frames = await Promise.all(
      ["#1f2937", "#0f766e", "#7c2d12"].map((background) =>
        sharp({
          create: { background, channels: 3, height: 2, width: 2 },
        })
          .png()
          .toBuffer()
      )
    )
    const animatedGif = await sharp(frames, { join: { animated: true } })
      .gif()
      .toBuffer()

    await expect(
      reencodeProxiedImage(animatedGif, { maxAnimationFrames: 2 })
    ).rejects.toThrow("too many animation frames")
  })

  it("removes metadata and returns a static approved WebP image", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 40, g: 30, r: 20 },
        channels: 4,
        height: 2,
        width: 2,
      },
    })
      .withMetadata({ orientation: 6 })
      .png()
      .toBuffer()

    const output = await reencodeProxiedImage(input)
    const metadata = await sharp(output.bytes).metadata()

    expect(output.contentType).toBe("image/webp")
    expect(imageSignature(output.bytes)).toBe("webp")
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
    expect(metadata.xmp).toBeUndefined()
  })

  it("rejects a valid image that exceeds the output-size policy", async () => {
    const input = await sharp({
      create: { background: "#204060", channels: 3, height: 2, width: 2 },
    })
      .png()
      .toBuffer()

    await expect(reencodeProxiedImage(input, { maxOutputBytes: 1 })).rejects.toThrow(
      "too large"
    )
  })
})
