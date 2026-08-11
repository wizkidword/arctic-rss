import { userSyncEventSchema } from "@arctic-rss/api-contract"

export function toMobileSyncEvent(event: {
  action: string
  occurredAt: Date
  payload: unknown
  resourceId: string
  resourceType: string
  resourceVersion: string
  sequence: bigint
}) {
  return userSyncEventSchema.parse({
    action: event.action,
    occurredAt: event.occurredAt.toISOString(),
    payload: event.payload,
    resourceId: event.resourceId,
    resourceType: event.resourceType,
    resourceVersion: event.resourceVersion,
    schemaVersion: 1,
    sequence: event.sequence.toString(),
  })
}
