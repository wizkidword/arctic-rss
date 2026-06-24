import { describe, expect, it } from "vitest"

import { isPrivateIpAddress, normalizeHttpUrl } from "./url-safety"

describe("feed URL safety", () => {
  it("normalizes bare hostnames as HTTPS URLs", () => {
    expect(normalizeHttpUrl("example.com/feed").href).toBe(
      "https://example.com/feed"
    )
  })

  it("only allows HTTP and HTTPS URLs", () => {
    expect(() => normalizeHttpUrl("ftp://example.com/feed")).toThrow(
      "Only HTTP and HTTPS URLs are supported"
    )
  })

  it("rejects internal hostnames", () => {
    expect(() => normalizeHttpUrl("http://localhost/feed")).toThrow(
      "Local and internal hostnames are not allowed"
    )
    expect(() => normalizeHttpUrl("http://printer/feed")).toThrow(
      "Local and internal hostnames are not allowed"
    )
  })

  it("identifies private and local IP ranges", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true)
    expect(isPrivateIpAddress("10.0.0.12")).toBe(true)
    expect(isPrivateIpAddress("172.20.1.1")).toBe(true)
    expect(isPrivateIpAddress("192.168.1.4")).toBe(true)
    expect(isPrivateIpAddress("169.254.10.20")).toBe(true)
    expect(isPrivateIpAddress("::1")).toBe(true)
    expect(isPrivateIpAddress("fd00::1")).toBe(true)
    expect(isPrivateIpAddress("fe80::1")).toBe(true)
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false)
    expect(isPrivateIpAddress("2606:4700:4700::1111")).toBe(false)
  })
})
