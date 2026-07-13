import { describe, expect, it, vi } from "vitest"

const { articleGroupBy } = vi.hoisted(() => ({
  articleGroupBy: vi.fn(),
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    article: {
      groupBy: articleGroupBy,
    },
  }),
}))

import { getUnreadArticleCountsByFeed } from "./articles"

describe("getUnreadArticleCountsByFeed", () => {
  it("uses one grouped query for a large feed navigation", async () => {
    const feedIds = Array.from({ length: 200 }, (_, index) => `feed-${index}`)
    articleGroupBy.mockResolvedValue([
      { _count: { _all: 7 }, feedId: "feed-0" },
      { _count: { _all: 2 }, feedId: "feed-199" },
    ])

    const counts = await getUnreadArticleCountsByFeed("user-1", feedIds)

    expect(articleGroupBy).toHaveBeenCalledTimes(1)
    expect(articleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        _count: { _all: true },
        by: ["feedId"],
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              feedId: {
                in: feedIds,
              },
            }),
          ]),
        }),
      })
    )
    expect(counts).toEqual(
      new Map([
        ["feed-0", 7],
        ["feed-199", 2],
      ])
    )
  })

  it("skips the database query when navigation has no feeds", async () => {
    articleGroupBy.mockReset()

    await expect(getUnreadArticleCountsByFeed("user-1", [])).resolves.toEqual(
      new Map()
    )

    expect(articleGroupBy).not.toHaveBeenCalled()
  })
})
