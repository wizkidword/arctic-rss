import { getPrisma } from "./db"

export class PodcastEpisodeStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PodcastEpisodeStateError"
  }
}

export async function savePodcastPlaybackProgress({
  episodeId,
  playbackPositionSeconds,
  userId,
}: {
  episodeId: string
  playbackPositionSeconds: number
  userId: string
}) {
  await assertPodcastEpisodeAccess({ episodeId, userId })
  const normalizedPosition = normalizePlaybackPosition(
    playbackPositionSeconds
  )

  return getPrisma().podcastEpisodeState.upsert({
    create: {
      episodeId,
      playbackPositionSeconds: normalizedPosition,
      userId,
    },
    update: {
      playbackPositionSeconds: normalizedPosition,
    },
    where: {
      userId_episodeId: {
        episodeId,
        userId,
      },
    },
  })
}

export async function markPodcastEpisodePlayed({
  episodeId,
  isPlayed,
  userId,
}: {
  episodeId: string
  isPlayed: boolean
  userId: string
}) {
  await assertPodcastEpisodeAccess({ episodeId, userId })

  return getPrisma().podcastEpisodeState.upsert({
    create: {
      episodeId,
      isPlayed,
      userId,
    },
    update: {
      isPlayed,
    },
    where: {
      userId_episodeId: {
        episodeId,
        userId,
      },
    },
  })
}

export async function togglePodcastEpisodeStar({
  episodeId,
  userId,
}: {
  episodeId: string
  userId: string
}) {
  await assertPodcastEpisodeAccess({ episodeId, userId })
  const prisma = getPrisma()
  const existing = await prisma.podcastEpisodeState.findUnique({
    where: {
      userId_episodeId: {
        episodeId,
        userId,
      },
    },
  })

  return prisma.podcastEpisodeState.upsert({
    create: {
      episodeId,
      isStarred: true,
      userId,
    },
    update: {
      isStarred: !(existing?.isStarred ?? false),
    },
    where: {
      userId_episodeId: {
        episodeId,
        userId,
      },
    },
  })
}

async function assertPodcastEpisodeAccess({
  episodeId,
  userId,
}: {
  episodeId: string
  userId: string
}) {
  const episode = await getPrisma().podcastEpisode.findFirst({
    where: {
      id: episodeId,
      podcast: {
        subscriptions: {
          some: { userId },
        },
      },
    },
    select: { id: true },
  })

  if (!episode) {
    throw new PodcastEpisodeStateError("Podcast episode was not found.")
  }
}

function normalizePlaybackPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}
