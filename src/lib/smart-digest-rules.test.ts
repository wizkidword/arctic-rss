import { describe, expect, it } from "vitest"

import {
  matchSmartDigestArticle,
  parseSmartDigestTerms,
} from "./smart-digest-rules"

const article = {
  contentText:
    "Officials discussed sanctions and nuclear inspections after talks.",
  feedTitle: "World Desk",
  summary: "Iran and U.S. diplomats met after a regional escalation.",
  title: "Iran-U.S. conflict talks resume",
}

describe("Smart Digest rule matching", () => {
  it("parses quoted phrases and loose keywords", () => {
    expect(parseSmartDigestTerms('"Iran-U.S. conflict" sanctions')).toEqual([
      { kind: "phrase", value: "iran-u.s. conflict" },
      { kind: "keyword", value: "sanctions" },
    ])
  })

  it("preserves array entries as intentional terms", () => {
    expect(parseSmartDigestTerms(["new york", '"u.s. policy"'])).toEqual([
      { kind: "keyword", value: "new york" },
      { kind: "phrase", value: "u.s. policy" },
    ])
  })

  it("skips empty quoted terms", () => {
    expect(parseSmartDigestTerms('"" iran')).toEqual([
      { kind: "keyword", value: "iran" },
    ])
    expect(parseSmartDigestTerms(['""', "iran"])).toEqual([
      { kind: "keyword", value: "iran" },
    ])
  })

  it("parses dashed quoted phrases as phrases", () => {
    expect(parseSmartDigestTerms('-"new york"')).toEqual([
      { kind: "phrase", value: "new york" },
    ])
    expect(parseSmartDigestTerms(['-"new york"'])).toEqual([
      { kind: "phrase", value: "new york" },
    ])
  })

  it("matches phrases and records matched fields", () => {
    expect(
      matchSmartDigestArticle({
        article,
        excludeTerms: [],
        includeTerms: ['"Iran-U.S. conflict"', "sanctions"],
      })
    ).toEqual({
      matched: true,
      matchedFields: ["title", "contentText"],
      matchedTerms: ["iran-u.s. conflict", "sanctions"],
      reason: 'Matched "iran-u.s. conflict" in title and "sanctions" in contentText.',
    })
  })

  it("does not match phrases inside larger words", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          contentText: null,
          feedTitle: "Tech Desk",
          summary: "The paid tier launched today.",
          title: "Pricing update",
        },
        excludeTerms: [],
        includeTerms: ['"ai"'],
      })
    ).toMatchObject({ matched: false })
  })

  it("records every matching field for an include term", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          ...article,
          contentText: "Sanctions remain under discussion.",
          summary: "Iran diplomats met again.",
          title: "Iran talks resume",
        },
        excludeTerms: [],
        includeTerms: ["Iran", "sanctions"],
      })
    ).toEqual({
      matched: true,
      matchedFields: ["title", "summary", "contentText"],
      matchedTerms: ["iran", "sanctions"],
      reason: 'Matched "iran" in title and summary and "sanctions" in contentText.',
    })
  })

  it("escapes regex-special keyword and phrase terms", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          contentText: "Engineers discussed C++ and U.S. policy updates.",
          feedTitle: "Tech Desk",
          summary: null,
          title: "Language standards",
        },
        excludeTerms: [],
        includeTerms: ["c++", '"u.s."'],
      })
    ).toEqual({
      matched: true,
      matchedFields: ["contentText"],
      matchedTerms: ["c++", "u.s."],
      reason: 'Matched "c++" in contentText and "u.s." in contentText.',
    })
  })

  it("rejects articles when an exclude term matches", () => {
    expect(
      matchSmartDigestArticle({
        article,
        excludeTerms: ["diplomats"],
        includeTerms: ["Iran"],
      })
    ).toMatchObject({
      matched: false,
      reason: 'Excluded by "diplomats" in summary.',
    })
  })

  it("records every matching field for an exclude term", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          ...article,
          contentText: "Sanctions remain under discussion.",
          summary: "Iran diplomats met again.",
          title: "Iran talks resume",
        },
        excludeTerms: ["Iran"],
        includeTerms: ["sanctions"],
      })
    ).toEqual({
      matched: false,
      matchedFields: ["title", "summary"],
      matchedTerms: ["iran"],
      reason: 'Excluded by "iran" in title and summary.',
    })
  })

  it("does not match partial words for keywords", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          ...article,
          contentText: "Inspectors reviewed the shipment.",
          summary: "Diplomats met after a regional escalation.",
          title: "Iranian train arrived",
        },
        excludeTerms: [],
        includeTerms: ["Iran"],
      })
    ).toMatchObject({ matched: false })
  })

  it("handles empty string and null fields without throwing", () => {
    expect(
      matchSmartDigestArticle({
        article: {
          contentText: null,
          feedTitle: null,
          summary: null,
          title: null,
        },
        excludeTerms: [],
        includeTerms: ["iran"],
      })
    ).toEqual({
      matched: false,
      matchedFields: [],
      matchedTerms: [],
      reason: "No include terms matched.",
    })

    expect(
      matchSmartDigestArticle({
        article: {
          contentText: "",
          feedTitle: "",
          summary: "",
          title: "",
        },
        excludeTerms: [],
        includeTerms: ["iran"],
      })
    ).toEqual({
      matched: false,
      matchedFields: [],
      matchedTerms: [],
      reason: "No include terms matched.",
    })
  })
})
