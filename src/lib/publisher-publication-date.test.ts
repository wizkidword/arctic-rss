import { describe, expect, it } from "vitest"

import {
  MAX_DATABASE_SAFE_PUBLICATION_DATE,
  MAX_PUBLICATION_FUTURE_SKEW_MS,
  MIN_ACCEPTED_PUBLICATION_DATE,
  parsePublisherPublicationDate,
} from "./publisher-publication-date"

describe("publisher publication date policy", () => {
  it("accepts the documented persistence boundaries", () => {
    expect(
      parsePublisherPublicationDate(MIN_ACCEPTED_PUBLICATION_DATE.toISOString(), {
        now: MIN_ACCEPTED_PUBLICATION_DATE,
      })
    ).toEqual({ date: MIN_ACCEPTED_PUBLICATION_DATE })
    expect(
      parsePublisherPublicationDate(MAX_DATABASE_SAFE_PUBLICATION_DATE.toISOString(), {
        now: MAX_DATABASE_SAFE_PUBLICATION_DATE,
      })
    ).toEqual({ date: MAX_DATABASE_SAFE_PUBLICATION_DATE })
  })

  it("classifies malformed, out-of-range, and far-future dates without preserving them", () => {
    const now = new Date("2026-08-09T12:00:00.000Z")

    expect(parsePublisherPublicationDate("not a date", { now })).toEqual({ diagnostic: "invalid" })
    expect(parsePublisherPublicationDate("1969-12-31T23:59:59.999Z", { now })).toEqual({
      diagnostic: "out-of-range",
    })
    expect(
      parsePublisherPublicationDate(
        new Date(now.valueOf() + MAX_PUBLICATION_FUTURE_SKEW_MS + 1).toISOString(),
        { now }
      )
    ).toEqual({ diagnostic: "future-skew" })
  })
})
