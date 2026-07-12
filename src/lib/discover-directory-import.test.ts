import { describe, expect, it, vi } from "vitest"

import { planDiscoverOpmlImport } from "./discover-directory-import"

function opml(outlines: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Example directory</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`
}

describe("discover OPML import planning", () => {
  it("turns OPML folders into non-nation Discover categories without shortcuts", async () => {
    const verifyFeed = vi.fn(async ({ xmlUrl }: { xmlUrl: string }) => ({
      ok: true as const,
      source: new URL(xmlUrl).hostname,
      url: xmlUrl.replace("http://", "https://"),
    }))

    const plan = await planDiscoverOpmlImport({
      opmlXml: opml(`
    <outline text="Security">
      <outline text="Cyber Daily" type="rss" xmlUrl="http://security.example/rss.xml" />
    </outline>
    <outline text="Design">
      <outline text="Design Weekly" type="rss" xmlUrl="http://design.example/feed.xml" />
    </outline>`),
      verifyFeed,
    })

    expect(plan.categories).toEqual([
      {
        countryCode: null,
        description: "Security RSS feeds imported from OPML.",
        feeds: [
          {
            aliases: ["http://security.example/rss.xml"],
            categoryId: "opml-security",
            id: "opml-security-cyber-daily",
            label: "Cyber Daily",
            source: "security.example",
            sortOrder: 0,
            url: "https://security.example/rss.xml",
          },
        ],
        id: "opml-security",
        label: "Security",
        sortOrder: 0,
      },
      {
        countryCode: null,
        description: "Design RSS feeds imported from OPML.",
        feeds: [
          {
            aliases: ["http://design.example/feed.xml"],
            categoryId: "opml-design",
            id: "opml-design-design-weekly",
            label: "Design Weekly",
            source: "design.example",
            sortOrder: 0,
            url: "https://design.example/feed.xml",
          },
        ],
        id: "opml-design",
        label: "Design",
        sortOrder: 1,
      },
    ])
    expect(plan.failedFeeds).toBe(0)
    expect(plan.totalFeeds).toBe(2)
    expect(verifyFeed).toHaveBeenCalledTimes(2)
  })

  it("prefixes country imports and marks them as nation-backed categories", async () => {
    const plan = await planDiscoverOpmlImport({
      categoryName: "General",
      countryCode: "BD",
      opmlXml: opml(`
    <outline text="Bangladesh Daily" type="rss" xmlUrl="https://bd.example/feed.xml" />`),
      verifyFeed: async ({ xmlUrl }) => ({
        ok: true,
        source: "bd.example",
        title: "Bangladesh Daily",
        url: xmlUrl,
      }),
    })

    expect(plan.categories).toHaveLength(1)
    expect(plan.categories[0]).toMatchObject({
      countryCode: "bd",
      description: "BD General RSS feeds imported from OPML.",
      id: "bd-general",
      label: "BD General",
    })
    expect(plan.categories[0].feeds[0]).toMatchObject({
      categoryId: "bd-general",
      id: "bd-general-bangladesh-daily",
      label: "Bangladesh Daily",
      url: "https://bd.example/feed.xml",
    })
  })

  it("skips feeds that fail verification and reports the rejected entries", async () => {
    const plan = await planDiscoverOpmlImport({
      categoryName: "Podcasts",
      opmlXml: opml(`
    <outline text="Working Feed" type="rss" xmlUrl="https://working.example/feed.xml" />
    <outline text="Broken Feed" type="rss" xmlUrl="https://broken.example/feed.xml" />`),
      verifyFeed: async ({ xmlUrl }) =>
        xmlUrl.includes("broken")
          ? {
              ok: false,
              message: "That address did not expose a readable RSS or Atom feed.",
            }
          : {
              ok: true,
              source: "working.example",
              url: xmlUrl,
            },
    })

    expect(plan.totalFeeds).toBe(2)
    expect(plan.failedFeeds).toBe(1)
    expect(plan.categories).toHaveLength(1)
    expect(plan.categories[0].feeds).toHaveLength(1)
    expect(plan.categories[0].feeds[0].label).toBe("Working Feed")
    expect(plan.errors).toEqual([
      {
        message: "That address did not expose a readable RSS or Atom feed.",
        title: "Broken Feed",
        xmlUrl: "https://broken.example/feed.xml",
      },
    ])
  })
})
