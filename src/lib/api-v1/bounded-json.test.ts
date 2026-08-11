import { describe, expect, it } from "vitest"

import { BoundedJsonBodyError, readBoundedJsonBody } from "./bounded-json"

describe("readBoundedJsonBody", () => {
  it("accepts a bounded JSON body", async () => {
    await expect(readBoundedJsonBody(jsonRequest('{"code":"safe"}'))).resolves.toEqual({ code: "safe" })
  })

  it("rejects a declared oversized request before reading its body", async () => {
    const request = jsonRequest('{"code":"safe"}', { "content-length": "8193" })

    await expect(readBoundedJsonBody(request, { maximumBytes: 8_192 })).rejects.toMatchObject({
      code: "request-too-large",
    } satisfies Partial<BoundedJsonBodyError>)
  })

  it("rejects an oversized chunked request while reading", async () => {
    const request = streamRequest(["{\"code\":\"", "x".repeat(32), "\"}"], { "content-type": "application/json" })

    await expect(readBoundedJsonBody(request, { maximumBytes: 16 })).rejects.toMatchObject({
      code: "request-too-large",
    } satisfies Partial<BoundedJsonBodyError>)
  })

  it("rejects an unreadable body after the deadline", async () => {
    const request = new Request("https://arcticrss.example/token", {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          setTimeout(() => {
            try {
              controller.enqueue(new TextEncoder().encode("{}"))
              controller.close()
            } catch {
              // The reader is intentionally cancelled when the deadline wins.
            }
          }, 30)
        },
      }),
      // Node's Request requires duplex for a streaming request body.
      duplex: "half",
      headers: { "content-type": "application/json" },
      method: "POST",
    } as RequestInit)

    await expect(readBoundedJsonBody(request, { timeoutMs: 5 })).rejects.toMatchObject({
      code: "request-timeout",
    } satisfies Partial<BoundedJsonBodyError>)
  })

  it("rejects unsupported media and content encodings", async () => {
    await expect(readBoundedJsonBody(jsonRequest("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({
      code: "unsupported-media-type",
    } satisfies Partial<BoundedJsonBodyError>)
    await expect(readBoundedJsonBody(jsonRequest("{}", { "content-encoding": "gzip" }))).rejects.toMatchObject({
      code: "unsupported-content-encoding",
    } satisfies Partial<BoundedJsonBodyError>)
  })

  it("rejects malformed JSON and malformed UTF-8 without retaining body text", async () => {
    await expect(readBoundedJsonBody(jsonRequest("{"))).rejects.toMatchObject({
      code: "invalid-body",
    } satisfies Partial<BoundedJsonBodyError>)

    const request = new Request("https://arcticrss.example/token", {
      body: new Uint8Array([0xc3, 0x28]),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    await expect(readBoundedJsonBody(request)).rejects.toMatchObject({
      code: "invalid-body",
    } satisfies Partial<BoundedJsonBodyError>)
  })
})

function jsonRequest(body: string, extraHeaders: Record<string, string> = {}) {
  return new Request("https://arcticrss.example/token", {
    body,
    headers: { "content-type": "application/json", ...extraHeaders },
    method: "POST",
  })
}

function streamRequest(chunks: string[], headers: Record<string, string>) {
  const encoder = new TextEncoder()
  return new Request("https://arcticrss.example/token", {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
    duplex: "half",
    headers,
    method: "POST",
  } as RequestInit)
}
