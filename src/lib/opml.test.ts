import { describe, expect, it, vi } from "vitest"

import { FeedSubscriptionError } from "./feed-subscriptions"
import {
  buildOpmlDocument,
  importOpmlWithClient,
  parseOpmlSubscriptions,
} from "./opml"

describe("OPML parsing", () => {
  it("extracts feeds and preserves folder names from Google Reader-style outlines", () => {
    const entries = parseOpmlSubscriptions(`
      <?xml version="1.0" encoding="UTF-8"?>
      <opml version="1.0">
        <body>
          <outline text="Tech">
            <outline text="xkcd" title="xkcd.com" type="rss" xmlUrl="https://xkcd.com/atom.xml" htmlUrl="https://xkcd.com" />
          </outline>
          <outline text="Security">
            <outline text="Krebs" type="rss" xmlUrl="https://krebsonsecurity.com/feed/" />
          </outline>
          <outline text="Unfiled" type="rss" xmlUrl="https://example.com/feed.xml" />
        </body>
      </opml>
    `)

    expect(entries).toEqual([
      {
        folderName: "Tech",
        htmlUrl: "https://xkcd.com",
        title: "xkcd.com",
        xmlUrl: "https://xkcd.com/atom.xml",
      },
      {
        folderName: "Security",
        htmlUrl: undefined,
        title: "Krebs",
        xmlUrl: "https://krebsonsecurity.com/feed/",
      },
      {
        folderName: null,
        htmlUrl: undefined,
        title: "Unfiled",
        xmlUrl: "https://example.com/feed.xml",
      },
    ])
  })
})

describe("OPML export", () => {
  it("groups subscriptions by folder and escapes XML attributes", () => {
    const opml = buildOpmlDocument({
      ownerName: "Arctic & Friends",
      subscriptions: [
        {
          folderName: "Tech",
          htmlUrl: "https://xkcd.com",
          title: "xkcd.com",
          xmlUrl: "https://xkcd.com/atom.xml",
        },
        {
          folderName: null,
          htmlUrl: "https://example.com/?a=1&b=2",
          title: "Amp & Volt",
          xmlUrl: "https://example.com/feed?a=1&b=2",
        },
      ],
    })

    expect(opml).toContain("<title>Arctic RSS subscriptions</title>")
    expect(opml).toContain("<ownerName>Arctic &amp; Friends</ownerName>")
    expect(opml).toContain('<outline text="Tech" title="Tech">')
    expect(opml).toContain(
      '<outline text="xkcd.com" title="xkcd.com" type="rss" xmlUrl="https://xkcd.com/atom.xml" htmlUrl="https://xkcd.com" />'
    )
    expect(opml).toContain(
      '<outline text="Amp &amp; Volt" title="Amp &amp; Volt" type="rss" xmlUrl="https://example.com/feed?a=1&amp;b=2" htmlUrl="https://example.com/?a=1&amp;b=2" />'
    )
  })
})

describe("OPML import", () => {
  it("creates folders, skips duplicate subscriptions, records failures, and updates an import job", async () => {
    const store = {
      folder: {
        create: vi.fn().mockResolvedValue({ id: "folder-1", name: "Tech" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      importJob: {
        create: vi.fn().mockResolvedValue({ id: "job-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    const subscribeToFeed = vi
      .fn()
      .mockResolvedValueOnce({ feedId: "feed-1" })
      .mockRejectedValueOnce(
        new FeedSubscriptionError("You are already subscribed to Existing.")
      )
      .mockRejectedValueOnce(new Error("Feed could not be parsed."))
    const enqueueFeedRefresh = vi.fn().mockResolvedValue({})

    const summary = await importOpmlWithClient({
      enqueueFeedRefresh,
      opmlXml: `
        <opml version="1.0">
          <body>
            <outline text="Tech">
              <outline text="xkcd" xmlUrl="https://xkcd.com/atom.xml" />
              <outline text="Existing" xmlUrl="https://example.com/existing.xml" />
            </outline>
            <outline text="Broken" xmlUrl="https://example.com/broken.xml" />
          </body>
        </opml>
      `,
      store,
      subscribeToFeed,
      userId: "user-1",
    })

    expect(summary).toEqual({
      addedFeeds: 1,
      failedFeeds: 1,
      folderCount: 1,
      jobId: "job-1",
      skippedFeeds: 1,
      totalFeeds: 3,
      errors: [
        {
          message: "Feed could not be parsed.",
          title: "Broken",
          xmlUrl: "https://example.com/broken.xml",
        },
      ],
    })
    expect(store.folder.create).toHaveBeenCalledWith({
      data: {
        name: "Tech",
        userId: "user-1",
      },
      select: {
        id: true,
        name: true,
      },
    })
    expect(subscribeToFeed).toHaveBeenNthCalledWith(1, {
      folderId: "folder-1",
      url: "https://xkcd.com/atom.xml",
      userId: "user-1",
    })
    expect(enqueueFeedRefresh).toHaveBeenCalledWith("feed-1")
    expect(store.importJob.update).toHaveBeenCalledWith({
      data: {
        addedFeeds: 1,
        errorLog: {
          errors: summary.errors,
          folderCount: 1,
        },
        failedFeeds: 1,
        skippedFeeds: 1,
        status: "COMPLETED",
        totalFeeds: 3,
      },
      where: { id: "job-1" },
    })
  })

  it("does not count a subscribed feed as failed when refresh enqueueing fails", async () => {
    const store = {
      folder: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      importJob: {
        create: vi.fn().mockResolvedValue({ id: "job-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    const subscribeToFeed = vi.fn().mockResolvedValue({ feedId: "feed-1" })
    const enqueueFeedRefresh = vi
      .fn()
      .mockRejectedValue(new Error("Queue unavailable."))

    const summary = await importOpmlWithClient({
      enqueueFeedRefresh,
      opmlXml: `
        <opml version="1.0">
          <body>
            <outline text="xkcd" xmlUrl="https://xkcd.com/atom.xml" />
          </body>
        </opml>
      `,
      store,
      subscribeToFeed,
      userId: "user-1",
    })

    expect(summary).toEqual({
      addedFeeds: 1,
      failedFeeds: 0,
      folderCount: 0,
      jobId: "job-1",
      skippedFeeds: 0,
      totalFeeds: 1,
      errors: [],
    })
  })
})
