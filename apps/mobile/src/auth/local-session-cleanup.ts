export type LocalSessionCleanupState = "signed-out-clean" | "signed-out-cleanup-required"

export async function clearLocalMobileData({
  clearSession,
  purgeOfflineData,
}: {
  clearSession: () => Promise<void>
  purgeOfflineData: () => Promise<void>
}): Promise<LocalSessionCleanupState> {
  // Run both cleanup operations even when either persistent store fails. The
  // session manager clears volatile tokens before its promise can reject; this
  // helper only decides whether it is safe to allow another account locally.
  const results = await Promise.allSettled([clearSession(), purgeOfflineData()])
  return results.every((result) => result.status === "fulfilled")
    ? "signed-out-clean"
    : "signed-out-cleanup-required"
}
