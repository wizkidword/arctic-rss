export const DEFAULT_MAINTENANCE_RETRY_BASE_MS = 60_000
export const DEFAULT_MAINTENANCE_RETRY_MAX_MS = 15 * 60_000

export type MaintenanceScheduleSnapshot = {
  failureCount: number
  lastSuccessAgeMs: number | null
  nextEligibleAt: number
}

export class MaintenanceSchedule {
  private failureCount = 0
  private lastSuccessAt: number | undefined
  private nextEligibleAt = 0
  private readonly normalIntervalMs: number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number

  constructor({
    normalIntervalMs,
    retryBaseMs = Math.min(
      DEFAULT_MAINTENANCE_RETRY_BASE_MS,
      Math.max(1_000, Math.floor(normalIntervalMs / 2))
    ),
    retryMaxMs = Math.min(
      DEFAULT_MAINTENANCE_RETRY_MAX_MS,
      Math.max(retryBaseMs, normalIntervalMs)
    ),
  }: {
    normalIntervalMs: number
    retryBaseMs?: number
    retryMaxMs?: number
  }) {
    this.normalIntervalMs = positiveDelay(normalIntervalMs)
    this.retryBaseMs = positiveDelay(retryBaseMs)
    this.retryMaxMs = Math.max(this.retryBaseMs, positiveDelay(retryMaxMs))
  }

  isDue(now: number) {
    return now >= this.nextEligibleAt
  }

  recordDeferred(now: number) {
    this.nextEligibleAt = now + this.normalIntervalMs
    return this.snapshot(now)
  }

  recordFailure(now: number) {
    this.failureCount += 1
    const exponent = Math.min(this.failureCount - 1, 30)
    const retryDelayMs = Math.min(
      this.retryMaxMs,
      this.retryBaseMs * 2 ** exponent
    )
    this.nextEligibleAt = now + retryDelayMs
    return this.snapshot(now)
  }

  recordSuccess(now: number) {
    this.failureCount = 0
    this.lastSuccessAt = now
    this.nextEligibleAt = now + this.normalIntervalMs
    return this.snapshot(now)
  }

  snapshot(now: number): MaintenanceScheduleSnapshot {
    return {
      failureCount: this.failureCount,
      lastSuccessAgeMs:
        this.lastSuccessAt === undefined ? null : Math.max(0, now - this.lastSuccessAt),
      nextEligibleAt: this.nextEligibleAt,
    }
  }
}

function positiveDelay(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1
}
