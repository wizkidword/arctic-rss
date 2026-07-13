import { describe, expect, it } from "vitest"

import { allowedImageContentType } from "./image-proxy"

describe("image proxy MIME policy", () => {
  it.each([
    ["image/png", "image/png"],
    ["image/WEBP; charset=binary", "image/webp"],
    ["image/vnd.microsoft.icon", "image/vnd.microsoft.icon"],
  ])("allows supported image MIME types (%s)", (value, expected) => {
    expect(allowedImageContentType(value)).toBe(expected)
  })

  it.each([
    "",
    "application/octet-stream",
    "image/svg+xml",
    "text/html",
  ])("rejects unsupported image MIME types (%s)", (value) => {
    expect(allowedImageContentType(value)).toBeNull()
  })
})
