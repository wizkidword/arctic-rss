import { describe, expect, it } from "vitest"

import {
  normalizePublisherExternalIdentity,
  normalizePublisherText,
} from "./publisher-text"

describe("publisher text normalization", () => {
  it("removes every XML 1.0-disallowed C0 control", () => {
    const disallowedControls = [
      ...Array.from({ length: 9 }, (_, index) => String.fromCharCode(index)),
      "\u000B",
      "\u000C",
      ...Array.from({ length: 18 }, (_, index) => String.fromCharCode(index + 14)),
    ].join("")

    expect(normalizePublisherText(`safe${disallowedControls}text`)).toMatchObject({
      diagnostics: {
        invalidXmlControlCharactersRemoved: 28,
        nullCharactersRemoved: 1,
      },
      value: "safetext",
    })
  })

  it("removes unsafe XML controls and preserves ordinary Unicode", () => {
    expect(normalizePublisherText("Hello\u0000\u0001\tworld\n🙂")).toEqual({
      diagnostics: {
        carriageReturnsNormalized: 0,
        invalidUnicodeScalarsRemoved: 0,
        invalidXmlControlCharactersRemoved: 1,
        nullCharactersRemoved: 1,
        unicodeNormalizationApplied: 0,
      },
      value: "Hello\tworld\n🙂",
    })
  })

  it("uses LF and NFC for display text", () => {
    expect(normalizePublisherText("Cafe\u0301\r\nnext\rline")).toEqual({
      diagnostics: {
        carriageReturnsNormalized: 2,
        invalidUnicodeScalarsRemoved: 0,
        invalidXmlControlCharactersRemoved: 0,
        nullCharactersRemoved: 0,
        unicodeNormalizationApplied: 1,
      },
      value: "Café\nnext\nline",
    })
  })

  it("does not NFC-normalize external identifiers", () => {
    const normalized = normalizePublisherExternalIdentity("Cafe\u0301\u0000\r")

    expect(normalized.value).toBe("Cafe\u0301\n")
    expect(normalized.diagnostics).toMatchObject({
      carriageReturnsNormalized: 1,
      nullCharactersRemoved: 1,
      unicodeNormalizationApplied: 0,
    })
  })

  it("removes unpaired surrogate code units before database boundaries", () => {
    expect(normalizePublisherText("safe\uD800text\uDC00")).toMatchObject({
      diagnostics: { invalidUnicodeScalarsRemoved: 2 },
      value: "safetext",
    })
  })
})
