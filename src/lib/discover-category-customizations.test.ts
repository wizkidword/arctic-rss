import { describe, expect, it, vi } from "vitest"

import {
  DiscoverCategoryMetadataError,
  updateDiscoverCategoryMetadata,
} from "./discover-category-customizations"

function createStore({
  dynamicCategoryExists = false,
}: {
  dynamicCategoryExists?: boolean
} = {}) {
  return {
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    discoverCategory: {
      findUnique: vi.fn().mockResolvedValue(
        dynamicCategoryExists
          ? {
              label: "Podcasts",
              slug: "opml-podcasts",
            }
          : null
      ),
    },
    discoverCategoryCustomization: {
      upsert: vi.fn().mockResolvedValue({
        categorySlug: "us-general",
      }),
    },
  }
}

describe("discover category customizations", () => {
  it("stores edited metadata for a built-in Discover category", async () => {
    const store = createStore()

    const result = await updateDiscoverCategoryMetadata({
      adminUserId: "admin-1",
      categoryId: "us-general",
      description: "A sharper national news description.",
      iconKey: "world",
      store,
    })

    expect(store.discoverCategory.findUnique).not.toHaveBeenCalled()
    expect(store.discoverCategoryCustomization.upsert).toHaveBeenCalledWith({
      create: {
        categorySlug: "us-general",
        description: "A sharper national news description.",
        iconKey: "world",
      },
      update: {
        description: "A sharper national news description.",
        iconKey: "world",
      },
      where: {
        categorySlug: "us-general",
      },
    })
    expect(store.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: "DISCOVER_CATEGORY_METADATA_UPDATE",
        adminUserId: "admin-1",
        metadata: {
          description: "A sharper national news description.",
          iconKey: "world",
        },
        targetId: "us-general",
        targetType: "DiscoverCategory",
      },
    })
    expect(result).toEqual({
      categoryId: "us-general",
      description: "A sharper national news description.",
      iconKey: "world",
      label: "US General",
    })
  })

  it("stores edited metadata for an imported Discover category", async () => {
    const store = createStore({ dynamicCategoryExists: true })

    await updateDiscoverCategoryMetadata({
      adminUserId: "admin-1",
      categoryId: "opml-podcasts",
      description: "Curated listening feeds.",
      iconKey: "audio",
      store,
    })

    expect(store.discoverCategory.findUnique).toHaveBeenCalledWith({
      select: { label: true, slug: true },
      where: { slug: "opml-podcasts" },
    })
    expect(store.discoverCategoryCustomization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          categorySlug: "opml-podcasts",
          iconKey: "audio",
        }),
      })
    )
  })

  it("rejects unknown categories and unsupported icon keys", async () => {
    const store = createStore()

    await expect(
      updateDiscoverCategoryMetadata({
        adminUserId: "admin-1",
        categoryId: "missing-category",
        description: "Nope.",
        iconKey: "world",
        store,
      })
    ).rejects.toThrow(DiscoverCategoryMetadataError)

    await expect(
      updateDiscoverCategoryMetadata({
        adminUserId: "admin-1",
        categoryId: "us-general",
        description: "Nope.",
        iconKey: "unsupported",
        store,
      })
    ).rejects.toThrow("Choose a supported Discover icon.")
  })
})
