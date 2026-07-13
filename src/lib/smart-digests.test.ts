import { describe, expect, it, vi } from "vitest"

import {
  DATABASE_SMART_DIGEST_LIMIT_ERROR,
  isDatabaseSmartDigestLimitError,
  SMART_DIGEST_FREE_ENABLED_LIMIT,
  SMART_DIGEST_PRO_ENABLED_LIMIT,
  smartDigestEnabledLimitForPlan,
} from "./smart-digest-limits"
import {
  createSmartDigestRuleForUserWithClient,
  listSmartDigestSourceOptionsWithClient,
  normalizeSmartDigestInput,
  scheduleNextSmartDigestRun,
  SmartDigestError,
  type SmartDigestInput,
  type SmartDigestStore,
} from "./smart-digests"

const baseInput: SmartDigestInput = {
  emailEnabled: true,
  excludeTerms: "",
  feedSubscriptionIds: [],
  folderIds: [],
  includeTerms: "climate",
  name: "Climate",
  scheduledHour: 8,
  sourceScope: "ALL_FEEDS",
  timeZone: "UTC",
  topicPrompt: "Climate news",
}

describe("smart digest limits", () => {
  it("returns enabled digest limits by plan", () => {
    expect(smartDigestEnabledLimitForPlan("FREE")).toBe(
      SMART_DIGEST_FREE_ENABLED_LIMIT
    )
    expect(smartDigestEnabledLimitForPlan("PRO")).toBe(
      SMART_DIGEST_PRO_ENABLED_LIMIT
    )
    expect(smartDigestEnabledLimitForPlan("ADMIN")).toBe(Number.POSITIVE_INFINITY)
  })

  it("recognizes the database guard's limit error without exposing database details", () => {
    expect(
      isDatabaseSmartDigestLimitError(
        new Error(`Database error: ${DATABASE_SMART_DIGEST_LIMIT_ERROR}`)
      )
    ).toBe(true)
    expect(isDatabaseSmartDigestLimitError(new Error("unrelated failure"))).toBe(false)
  })
})

describe("smart digest input normalization", () => {
  it("requires at least one include term", () => {
    expect(() =>
      normalizeSmartDigestInput({
        ...baseInput,
        includeTerms: " , \n ",
      })
    ).toThrow(new SmartDigestError("Add at least one include term."))
  })

  it("normalizes terms, trims text fields, clamps high hours, and falls back to UTC", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        excludeTerms: 'spam, "low quality"\nnoise noise',
        includeTerms: ' AI, "machine learning"\nAI  climate ',
        name: "  Morning   Briefing  ",
        scheduledHour: 28,
        timeZone: "Mars/Olympus",
        topicPrompt: "  Track   applied   AI  ",
      })
    ).toMatchObject({
      excludeTerms: ["spam", "low quality", "noise"],
      includeTerms: ["ai", "machine learning", "climate"],
      name: "Morning Briefing",
      scheduledHour: 23,
      timeZone: "UTC",
      topicPrompt: "Track applied AI",
    })
  })

  it("clamps low scheduled hours to 0", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        scheduledHour: -2,
      })
    ).toMatchObject({
      scheduledHour: 0,
    })
  })

  it("rounds finite scheduled hours", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        scheduledHour: 6.7,
      })
    ).toMatchObject({
      scheduledHour: 7,
    })
  })

  it("defaults invalid scheduled hours to 8", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        scheduledHour: Number.NaN,
      })
    ).toMatchObject({
      scheduledHour: 8,
    })
  })

  it("clears selected ids for all feeds", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        feedSubscriptionIds: [" sub-1 "],
        folderIds: ["folder-1"],
        sourceScope: "ALL_FEEDS",
      })
    ).toMatchObject({
      feedSubscriptionIds: [],
      folderIds: [],
      sourceScope: "ALL_FEEDS",
    })
  })

  it("falls back invalid source scope to all feeds", () => {
    expect(
      normalizeSmartDigestInput({
        ...baseInput,
        feedSubscriptionIds: ["sub-1"],
        folderIds: ["folder-1"],
        sourceScope: "SOMETHING_ELSE" as SmartDigestInput["sourceScope"],
      })
    ).toMatchObject({
      feedSubscriptionIds: [],
      folderIds: [],
      sourceScope: "ALL_FEEDS",
    })
  })

  it("requires folder ids for folder scope", () => {
    expect(() =>
      normalizeSmartDigestInput({
        ...baseInput,
        folderIds: [],
        sourceScope: "FOLDERS",
      })
    ).toThrow(new SmartDigestError("Choose at least one folder."))
  })

  it("requires feed subscription ids for feed scope", () => {
    expect(() =>
      normalizeSmartDigestInput({
        ...baseInput,
        feedSubscriptionIds: [],
        sourceScope: "FEEDS",
      })
    ).toThrow(new SmartDigestError("Choose at least one feed."))
  })
})

describe("smart digest scheduling", () => {
  it("schedules the next selected local hour in the requested time zone", () => {
    expect(
      scheduleNextSmartDigestRun({
        from: new Date("2026-06-30T12:00:00.000Z"),
        scheduledHour: 8,
        timeZone: "America/New_York",
      }).toISOString()
    ).toBe("2026-07-01T12:00:00.000Z")
  })
})

describe("smart digest services", () => {
  it("blocks free users from enabling a second smart digest", async () => {
    const store = createStore({
      user: {
        _count: { smartDigestRules: SMART_DIGEST_FREE_ENABLED_LIMIT },
        plan: "FREE",
      },
    })

    await expect(
      createSmartDigestRuleForUserWithClient({
        input: baseInput,
        store,
        userId: "user-1",
      })
    ).rejects.toThrow(
      new SmartDigestError("Free accounts can enable one Smart Digest.")
    )
    expect(store.smartDigestRule.create).not.toHaveBeenCalled()
  })

  it("allows non-free users to create under their limit", async () => {
    const store = createStore({
      createdRule: { id: "rule-1" },
      user: {
        _count: { smartDigestRules: SMART_DIGEST_PRO_ENABLED_LIMIT - 1 },
        plan: "PRO",
      },
    })

    await expect(
      createSmartDigestRuleForUserWithClient({
        input: {
          ...baseInput,
          includeTerms: "AI",
          name: " AI  Digest ",
          topicPrompt: " Applied AI ",
        },
        now: new Date("2026-06-30T12:00:00.000Z"),
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({ id: "rule-1" })

    expect(store.smartDigestRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cadence: "DAILY",
          includeTerms: ["ai"],
          name: "AI Digest",
          nextRunAt: new Date("2026-07-01T08:00:00.000Z"),
          subscriptions: { create: [] },
          folders: { create: [] },
          topicPrompt: "Applied AI",
          userId: "user-1",
        }),
      })
    )
  })

  it("throws when the user is missing", async () => {
    await expect(
      createSmartDigestRuleForUserWithClient({
        input: baseInput,
        store: createStore({ user: null }),
        userId: "missing-user",
      })
    ).rejects.toThrow(new SmartDigestError("User not found."))
  })

  it("rejects selected folders that do not all belong to the user", async () => {
    const store = createStore({
      folders: [{ id: "folder-1" }],
      user: { _count: { smartDigestRules: 0 }, plan: "PRO" },
    })

    await expect(
      createSmartDigestRuleForUserWithClient({
        input: {
          ...baseInput,
          folderIds: ["folder-1", "other-folder"],
          sourceScope: "FOLDERS",
        },
        store,
        userId: "user-1",
      })
    ).rejects.toThrow(new SmartDigestError("Selected folders were not found."))

    expect(store.folder.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: { in: ["folder-1", "other-folder"] },
        userId: "user-1",
      },
    })
  })

  it("rejects selected feed subscriptions that are missing, cross-user, or paused", async () => {
    const store = createStore({
      subscriptions: [{ id: "sub-1" }],
      user: { _count: { smartDigestRules: 0 }, plan: "PRO" },
    })

    await expect(
      createSmartDigestRuleForUserWithClient({
        input: {
          ...baseInput,
          feedSubscriptionIds: ["sub-1", "paused-sub"],
          sourceScope: "FEEDS",
        },
        store,
        userId: "user-1",
      })
    ).rejects.toThrow(
      new SmartDigestError("Selected feeds were not found or are paused.")
    )

    expect(store.feedSubscription.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: { in: ["sub-1", "paused-sub"] },
        isPaused: false,
        userId: "user-1",
      },
    })
  })

  it("creates folder and subscription joins with user ownership data", async () => {
    const store = createStore({
      createdRule: { id: "rule-1" },
      folders: [{ id: "folder-1" }],
      subscriptions: [{ id: "sub-1" }],
      user: { _count: { smartDigestRules: 0 }, plan: "ADMIN" },
    })

    await createSmartDigestRuleForUserWithClient({
      input: {
        ...baseInput,
        folderIds: ["folder-1"],
        sourceScope: "FOLDERS",
      },
      store,
      userId: "user-1",
    })

    expect(store.smartDigestRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folders: {
            create: [{ folderId: "folder-1", userId: "user-1" }],
          },
          subscriptions: { create: [] },
        }),
      })
    )

    await createSmartDigestRuleForUserWithClient({
      input: {
        ...baseInput,
        feedSubscriptionIds: ["sub-1"],
        sourceScope: "FEEDS",
      },
      store,
      userId: "user-1",
    })

    expect(store.smartDigestRule.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folders: { create: [] },
          subscriptions: {
            create: [{ subscriptionId: "sub-1", userId: "user-1" }],
          },
        }),
      })
    )
  })

  it("filters paused subscriptions out of source options", async () => {
    const store = createStore({
      sourceFolders: [{ id: "folder-1", name: "News" }],
      sourceSubscriptions: [
        {
          id: "sub-1",
          customTitle: null,
          feed: { faviconUrl: null, title: "Arctic Feed" },
          folder: { id: "folder-1", name: "News" },
          folderId: "folder-1",
          isPaused: false,
        },
      ],
    })

    await expect(
      listSmartDigestSourceOptionsWithClient({ store, userId: "user-1" })
    ).resolves.toEqual({
      folders: [{ id: "folder-1", name: "News" }],
      subscriptions: [
        {
          faviconUrl: null,
          folderId: "folder-1",
          folderName: "News",
          id: "sub-1",
          title: "Arctic Feed",
        },
      ],
    })

    expect(store.feedSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPaused: false, userId: "user-1" },
      })
    )
  })
})

function createStore({
  createdRule = { id: "created-rule" },
  folders = [],
  sourceFolders = folders,
  sourceSubscriptions,
  subscriptions = [],
  user = { _count: { smartDigestRules: 0 }, plan: "FREE" },
}: {
  createdRule?: unknown
  folders?: Array<{ id: string }>
  sourceFolders?: Array<{ id: string; name?: string }>
  sourceSubscriptions?: unknown[]
  subscriptions?: Array<{ id: string }>
  user?: { _count: { smartDigestRules: number }; plan: "FREE" | "PRO" | "ADMIN" } | null
} = {}) {
  const store = {
    feedSubscription: {
      findMany: vi.fn((args) => {
        if (args?.select?.id) {
          return Promise.resolve(subscriptions)
        }

        return Promise.resolve(sourceSubscriptions ?? subscriptions)
      }),
    },
    folder: {
      findMany: vi.fn((args) => {
        if (args?.select?.id && !args?.orderBy) {
          return Promise.resolve(folders)
        }

        return Promise.resolve(sourceFolders)
      }),
    },
    smartDigestRule: {
      create: vi.fn().mockResolvedValue(createdRule),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  }

  return store as typeof store & SmartDigestStore
}
