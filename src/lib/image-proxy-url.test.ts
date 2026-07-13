import { describe, expect, it } from "vitest"

import { imageProxyUrl } from "./image-proxy-url"

describe("imageProxyUrl", () => {
  it("routes public HTTP(S) images through the local proxy", () => {
    expect(imageProxyUrl("https://images.example.com/photo.jpg#fragment")).toBe(
      "/api/image?url=https%3A%2F%2Fimages.example.com%2Fphoto.jpg"
    )
  })

  it("leaves an existing proxy URL unchanged", () => {
    const proxyUrl = "/api/image?url=https%3A%2F%2Fimages.example.com%2Fphoto.jpg"

    expect(imageProxyUrl(proxyUrl)).toBe(proxyUrl)
  })

  it.each([
    "data:image/png;base64,abc",
    "file:///etc/passwd",
    "https://user:password@images.example.com/photo.jpg",
    "not a URL",
    "",
    null,
  ])("does not expose invalid image sources (%s)", (value) => {
    expect(imageProxyUrl(value)).toBeNull()
  })
})
