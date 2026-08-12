import { describe, expect, it } from "vitest"

import {
  BoundedUrlEncodedFormError,
  readBoundedUrlEncodedForm,
} from "./bounded-urlencoded-form"

const allowedFields = ["approval_token", "decision", "request_id"]

describe("readBoundedUrlEncodedForm", () => {
  it("accepts a small urlencoded form with only allowed singleton fields", async () => {
    const form = await readBoundedUrlEncodedForm(
      formRequest("approval_token=one&decision=approve&request_id=request-1"),
      { allowedFields }
    )

    expect(form).toEqual({ approval_token: "one", decision: "approve", request_id: "request-1" })
  })

  it.each([
    ["multipart", new Request("https://example.test", { body: new FormData(), method: "POST" }), "unsupported-media-type"],
    ["compressed", formRequest("decision=approve", { "Content-Encoding": "gzip" }), "unsupported-content-encoding"],
    ["duplicate", formRequest("decision=approve&decision=cancel"), "invalid-body"],
    ["unknown", formRequest("decision=approve&surprise=value"), "invalid-body"],
    ["oversized", formRequest("x".repeat(33)), "request-too-large"],
  ] as const)("rejects %s form input", async (_name, request, code) => {
    await expect(readBoundedUrlEncodedForm(request, { allowedFields, maximumBytes: 32 }))
      .rejects.toMatchObject({ code } satisfies Partial<BoundedUrlEncodedFormError>)
  })
})

function formRequest(body: string, additionalHeaders: Record<string, string> = {}) {
  return new Request("https://example.test", {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...additionalHeaders },
    method: "POST",
  })
}
