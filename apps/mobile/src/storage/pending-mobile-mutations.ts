import {
  assertPendingMobileMutation,
  assertQueuedMutation,
  type PendingMobileMutation,
} from "@arctic-rss/mobile-client"

export type StoredPendingMutationRow = { idempotencyKey: string; payload: string }

export function readPendingMobileMutations(rows: StoredPendingMutationRow[]) {
  const corruptKeys: string[] = []
  const mutations: PendingMobileMutation[] = []
  for (const row of rows) {
    try {
      const mutation = JSON.parse(row.payload) as PendingMobileMutation
      assertQueuedMutation(mutation)
      assertPendingMobileMutation(mutation)
      mutations.push(mutation)
    } catch {
      corruptKeys.push(row.idempotencyKey)
    }
  }
  return { corruptKeys, mutations }
}
