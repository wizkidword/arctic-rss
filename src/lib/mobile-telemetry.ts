export type MobileAuthorizationDecision = "approved" | "cancelled" | "failure"
export type MobileTokenRefreshOutcome =
  | "invalid"
  | "reuse_detected"
  | "retryable_failure"
  | "success"

export function recordMobileAuthorizationDecision(decision: MobileAuthorizationDecision) {
  recordMobileMetric({ decision, event: "mobile_authorization_decision" })
}

export function recordMobileTokenRefresh(outcome: MobileTokenRefreshOutcome) {
  recordMobileMetric({ event: "mobile_token_refresh", outcome })
}

export function recordMobileSyncPage({
  durationMs,
  eventCount,
  fullResyncRequired,
  hasMore,
}: {
  durationMs: number
  eventCount: number
  fullResyncRequired: boolean
  hasMore: boolean
}) {
  recordMobileMetric({
    durationMs: Math.max(0, Math.round(durationMs)),
    event: "mobile_sync_page",
    eventCount: Math.max(0, Math.round(eventCount)),
    fullResyncRequired,
    hasMore,
  })
}

export function recordMobileJournalRetention({
  activeStableDeviceCount,
  oldestRetainedEventAgeMs,
  retainedEvents,
  rowsPruned,
}: {
  activeStableDeviceCount: number
  oldestRetainedEventAgeMs: number | null
  retainedEvents: number
  rowsPruned: number
}) {
  recordMobileMetric({
    activeStableDeviceCount: Math.max(0, Math.round(activeStableDeviceCount)),
    event: "mobile_sync_journal",
    oldestRetainedEventAgeMs:
      oldestRetainedEventAgeMs === null ? null : Math.max(0, Math.round(oldestRetainedEventAgeMs)),
    retainedEvents: Math.max(0, Math.round(retainedEvents)),
    rowsPruned: Math.max(0, Math.round(rowsPruned)),
  })
}

function recordMobileMetric(metric: Record<string, boolean | number | string | null>) {
  // These are aggregate operational records. Do not add user/device IDs,
  // emails, source/article IDs, search text, tokens, request bodies, header
  // values, or free-form device names.
  console.info(JSON.stringify(metric))
}
