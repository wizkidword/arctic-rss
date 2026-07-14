type LastLoginStore = {
  user: {
    update(args: {
      data: {
        lastLoginAt: Date
      }
      where: {
        id: string
      }
    }): Promise<unknown>
  }
}

export async function recordSuccessfulLogin({
  now = () => new Date(),
  store,
  userId,
}: {
  now?: () => Date
  store: LastLoginStore
  userId: string | undefined
}) {
  if (!userId) {
    return
  }

  await store.user.update({
    data: {
      lastLoginAt: now(),
    },
    where: {
      id: userId,
    },
  })
}

export async function recordSuccessfulLoginSafely({
  now,
  store,
  userId,
}: {
  now?: () => Date
  store: LastLoginStore
  userId: string | undefined
}) {
  try {
    await recordSuccessfulLogin({ now, store, userId })
  } catch {
    console.error("Failed to record successful sign-in.")
  }
}
