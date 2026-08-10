import { describe, expect, it } from "vitest"

import { getIngestionLimits, truncateUtf8Bytes } from "./ingestion-limits"

describe("ingestion limits", () => {
  it("uses reviewed defaults and ignores unsafe environment overrides", () => {
    expect(getIngestionLimits({
      INGESTION_MAX_EXTERNAL_ID_BYTES: "4096",
      INGESTION_MAX_FEED_ITEMS: "25",
      INGESTION_MAX_TITLE_CHARACTERS: "999999",
    })).toMatchObject({
      maxExternalIdBytes: 2_048,
      maxFeedItems: 25,
      maxTitleCharacters: 1_000,
    })
  })

  it("truncates at a UTF-8 character boundary", () => {
    expect(truncateUtf8Bytes("a🙂b", 5)).toBe("a🙂")
  })
})
