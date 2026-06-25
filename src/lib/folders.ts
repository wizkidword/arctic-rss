import { Prisma } from "../generated/prisma/client"
import { cache } from "react"

import { getPrisma } from "./db"

type FolderLookup = {
  id: string
}

type FolderStore = {
  feedSubscription: {
    findFirst(args: {
      select: { id: true }
      where: Prisma.FeedSubscriptionWhereInput
    }): Promise<FolderLookup | null>
    update(args: {
      data: {
        folderId: string | null
      }
      where: {
        id: string
      }
    }): Promise<unknown>
    updateMany(args: {
      data: {
        folderId: null
      }
      where: {
        folderId: string
        userId: string
      }
    }): Promise<{ count: number }>
  }
  folder: {
    create(args: {
      data: {
        name: string
        userId: string
      }
      select: {
        id: true
        name: true
      }
    }): Promise<{ id: string; name: string }>
    delete(args: {
      where: {
        id: string
      }
    }): Promise<unknown>
    findFirst(args: {
      select: { id: true }
      where: Prisma.FolderWhereInput
    }): Promise<FolderLookup | null>
    update(args: {
      data: {
        name: string
      }
      where: {
        id: string
      }
    }): Promise<unknown>
  }
}

export type FolderNavItem = {
  id: string
  name: string
  subscriptionCount: number
  unreadCount: number
}

export class FolderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FolderError"
  }
}

export const listUserFolders = cache(async function listUserFolders(
  userId: string
): Promise<FolderNavItem[]> {
  const folders = await getPrisma().folder.findMany({
    include: {
      subscriptions: {
        select: {
          feedId: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    where: { userId },
  })

  return Promise.all(
    folders.map(async (folder) => ({
      id: folder.id,
      name: folder.name,
      subscriptionCount: folder.subscriptions.length,
      unreadCount: await countUnreadArticlesForFolder(userId, folder.id),
    }))
  )
})

export async function getUserFolder(
  userId: string,
  folderId: string
): Promise<FolderNavItem | null> {
  const folder = await getPrisma().folder.findFirst({
    include: {
      subscriptions: {
        select: {
          feedId: true,
        },
      },
    },
    where: {
      id: folderId,
      userId,
    },
  })

  if (!folder) {
    return null
  }

  return {
    id: folder.id,
    name: folder.name,
    subscriptionCount: folder.subscriptions.length,
    unreadCount: await countUnreadArticlesForFolder(userId, folder.id),
  }
}

export async function countUnreadArticlesForFolder(
  userId: string,
  folderId: string
) {
  return getPrisma().article.count({
    where: {
      AND: [
        {
          feed: {
            subscriptions: {
              some: {
                folderId,
                isPaused: false,
                userId,
              },
            },
          },
        },
        {
          states: {
            none: {
              isRead: true,
              userId,
            },
          },
        },
      ],
    },
  })
}

export async function createFolder({
  name,
  userId,
}: {
  name: string
  userId: string
}) {
  return createFolderWithClient({
    name,
    store: getFolderStore(),
    userId,
  })
}

export async function createFolderWithClient({
  name,
  store,
  userId,
}: {
  name: string
  store: FolderStore
  userId: string
}) {
  const normalizedName = normalizeFolderName(name)

  return store.folder.create({
    data: {
      name: normalizedName,
      userId,
    },
    select: {
      id: true,
      name: true,
    },
  })
}

export async function renameFolder({
  folderId,
  name,
  userId,
}: {
  folderId: string
  name: string
  userId: string
}) {
  return renameFolderWithClient({
    folderId,
    name,
    store: getFolderStore(),
    userId,
  })
}

export async function renameFolderWithClient({
  folderId,
  name,
  store,
  userId,
}: {
  folderId: string
  name: string
  store: FolderStore
  userId: string
}) {
  const normalizedName = normalizeFolderName(name)

  await assertFolderBelongsToUser({
    folderId,
    store,
    userId,
  })

  await store.folder.update({
    data: {
      name: normalizedName,
    },
    where: { id: folderId },
  })
}

export async function deleteFolder({
  folderId,
  userId,
}: {
  folderId: string
  userId: string
}) {
  return deleteFolderWithClient({
    folderId,
    store: getFolderStore(),
    userId,
  })
}

export async function deleteFolderWithClient({
  folderId,
  store,
  userId,
}: {
  folderId: string
  store: FolderStore
  userId: string
}) {
  await assertFolderBelongsToUser({
    folderId,
    store,
    userId,
  })

  const result = await store.feedSubscription.updateMany({
    data: {
      folderId: null,
    },
    where: {
      folderId,
      userId,
    },
  })

  await store.folder.delete({
    where: { id: folderId },
  })

  return {
    movedSubscriptions: result.count,
  }
}

export async function moveSubscriptionToFolder({
  folderId,
  subscriptionId,
  userId,
}: {
  folderId: string | null
  subscriptionId: string
  userId: string
}) {
  return moveSubscriptionToFolderWithClient({
    folderId,
    store: getFolderStore(),
    subscriptionId,
    userId,
  })
}

export async function moveSubscriptionToFolderWithClient({
  folderId,
  store,
  subscriptionId,
  userId,
}: {
  folderId: string | null
  store: FolderStore
  subscriptionId: string
  userId: string
}) {
  await assertSubscriptionBelongsToUser({
    store,
    subscriptionId,
    userId,
  })

  if (folderId) {
    await assertFolderBelongsToUser({
      folderId,
      store,
      userId,
    })
  }

  await store.feedSubscription.update({
    data: {
      folderId,
    },
    where: { id: subscriptionId },
  })
}

function normalizeFolderName(name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ")

  if (!normalizedName) {
    throw new FolderError("Folder name is required.")
  }

  if (normalizedName.length > 80) {
    throw new FolderError("Folder name must be 80 characters or fewer.")
  }

  return normalizedName
}

async function assertFolderBelongsToUser({
  folderId,
  store,
  userId,
}: {
  folderId: string
  store: FolderStore
  userId: string
}) {
  const folder = await store.folder.findFirst({
    select: { id: true },
    where: {
      id: folderId,
      userId,
    },
  })

  if (!folder) {
    throw new FolderError("Folder not found.")
  }
}

async function assertSubscriptionBelongsToUser({
  store,
  subscriptionId,
  userId,
}: {
  store: FolderStore
  subscriptionId: string
  userId: string
}) {
  const subscription = await store.feedSubscription.findFirst({
    select: { id: true },
    where: {
      id: subscriptionId,
      userId,
    },
  })

  if (!subscription) {
    throw new FolderError("Feed subscription not found.")
  }
}

function getFolderStore() {
  return getPrisma() as unknown as FolderStore
}
