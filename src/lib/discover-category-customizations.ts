import { getPrisma } from "./db"
import { getDiscoverDirectory } from "./discover-directory"
import { feedDirectoryCategories } from "./feed-directory"
import {
  discoverCategoryIconOptions,
  isDiscoverCategoryIconKey,
  type DiscoverCategoryIconKey,
} from "./discover-category-icons"

const MAX_DISCOVER_CATEGORY_DESCRIPTION_LENGTH = 300

type DiscoverCategoryMetadataStore = {
  adminAuditLog: {
    create(args: {
      data: {
        action: string
        adminUserId: string
        metadata: {
          description: string
          iconKey: DiscoverCategoryIconKey
        }
        targetId: string
        targetType: string
      }
    }): Promise<unknown>
  }
  discoverCategory: {
    findUnique(args: {
      select: {
        label: true
        slug: true
      }
      where: {
        slug: string
      }
    }): Promise<{ label: string; slug: string } | null>
  }
  discoverCategoryCustomization: {
    upsert(args: {
      create: {
        categorySlug: string
        description: string
        iconKey: DiscoverCategoryIconKey
      }
      update: {
        description: string
        iconKey: DiscoverCategoryIconKey
      }
      where: {
        categorySlug: string
      }
    }): Promise<unknown>
  }
}

export type DiscoverCategoryEditorOption = {
  readonly description: string
  readonly iconKey: DiscoverCategoryIconKey
  readonly id: string
  readonly label: string
}

export type UpdateDiscoverCategoryMetadataInput = {
  readonly adminUserId: string
  readonly categoryId?: string
  readonly description?: string
  readonly iconKey?: string
  readonly store?: DiscoverCategoryMetadataStore
}

export type UpdateDiscoverCategoryMetadataResult = {
  readonly categoryId: string
  readonly description: string
  readonly iconKey: DiscoverCategoryIconKey
  readonly label: string
}

export class DiscoverCategoryMetadataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DiscoverCategoryMetadataError"
  }
}

export async function listDiscoverCategoryEditorOptions(): Promise<
  DiscoverCategoryEditorOption[]
> {
  const directory = await getDiscoverDirectory()

  return directory.categories.map((category) => ({
    description: category.description,
    iconKey: category.iconKey,
    id: category.id,
    label: category.label,
  }))
}

export async function updateDiscoverCategoryMetadata({
  adminUserId,
  categoryId,
  description,
  iconKey,
  store = getDiscoverCategoryMetadataStore(),
}: UpdateDiscoverCategoryMetadataInput): Promise<UpdateDiscoverCategoryMetadataResult> {
  const normalizedCategoryId = categoryId?.trim()
  const normalizedDescription = description?.trim()

  if (!normalizedCategoryId) {
    throw new DiscoverCategoryMetadataError("Choose a Discover card to edit.")
  }

  if (!normalizedDescription) {
    throw new DiscoverCategoryMetadataError(
      "Enter a Discover card description."
    )
  }

  if (
    normalizedDescription.length > MAX_DISCOVER_CATEGORY_DESCRIPTION_LENGTH
  ) {
    throw new DiscoverCategoryMetadataError(
      `Keep the Discover card description under ${MAX_DISCOVER_CATEGORY_DESCRIPTION_LENGTH} characters.`
    )
  }

  if (!isDiscoverCategoryIconKey(iconKey)) {
    throw new DiscoverCategoryMetadataError("Choose a supported Discover icon.")
  }

  const category = await findDiscoverCategory(normalizedCategoryId, store)

  if (!category) {
    throw new DiscoverCategoryMetadataError("Choose a valid Discover card.")
  }

  await store.discoverCategoryCustomization.upsert({
    create: {
      categorySlug: category.id,
      description: normalizedDescription,
      iconKey,
    },
    update: {
      description: normalizedDescription,
      iconKey,
    },
    where: {
      categorySlug: category.id,
    },
  })

  await store.adminAuditLog.create({
    data: {
      action: "DISCOVER_CATEGORY_METADATA_UPDATE",
      adminUserId,
      metadata: {
        description: normalizedDescription,
        iconKey,
      },
      targetId: category.id,
      targetType: "DiscoverCategory",
    },
  })

  return {
    categoryId: category.id,
    description: normalizedDescription,
    iconKey,
    label: category.label,
  }
}

async function findDiscoverCategory(
  categoryId: string,
  store: DiscoverCategoryMetadataStore
) {
  const staticCategory = feedDirectoryCategories.find(
    (category) => category.id === categoryId
  )

  if (staticCategory) {
    return {
      id: staticCategory.id,
      label: staticCategory.label,
    }
  }

  const dynamicCategory = await store.discoverCategory.findUnique({
    select: {
      label: true,
      slug: true,
    },
    where: {
      slug: categoryId,
    },
  })

  if (!dynamicCategory) {
    return null
  }

  return {
    id: dynamicCategory.slug,
    label: dynamicCategory.label,
  }
}

function getDiscoverCategoryMetadataStore() {
  return getPrisma() as unknown as DiscoverCategoryMetadataStore
}

export { discoverCategoryIconOptions }
