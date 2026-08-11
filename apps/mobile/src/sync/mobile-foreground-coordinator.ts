import { MobileApiError, MobileNetworkError } from "@arctic-rss/mobile-client"

export type MobileForegroundSyncState =
  | "auth-required"
  | "conflicts"
  | "idle"
  | "offline"
  | "syncing"

export type MobileForegroundSyncSnapshot = {
  conflictCount: number
  lastSuccessfulSyncAt: number | null
  state: MobileForegroundSyncState
}

export class MobileForegroundCoordinator {
  private conflictCount = 0
  private lastSuccessfulSyncAt: number | null = null
  private rerunRequested = false
  private returnSessionRequested = false
  private running: Promise<void> | null = null
  private state: MobileForegroundSyncState = "idle"

  constructor(
    private readonly options: {
      claimOwner: () => Promise<void>
      flush: () => Promise<{ conflicts: number }>
      now?: () => number
      onStateChange?: (snapshot: MobileForegroundSyncSnapshot) => void
      sync: (options: { returnSession: boolean }) => Promise<unknown>
    }
  ) {}

  request({ returnSession = false }: { returnSession?: boolean } = {}) {
    this.rerunRequested = true
    this.returnSessionRequested ||= returnSession
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null
      })
    }
    return this.running
  }

  snapshot(): MobileForegroundSyncSnapshot {
    return {
      conflictCount: this.conflictCount,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      state: this.state,
    }
  }

  private async drain() {
    let lastError: unknown
    while (this.rerunRequested) {
      const returnSession = this.returnSessionRequested
      this.rerunRequested = false
      this.returnSessionRequested = false
      this.setState("syncing")
      try {
        await this.options.claimOwner()
        const flushed = await this.options.flush()
        this.conflictCount = flushed.conflicts
        await this.options.sync({ returnSession })
        this.lastSuccessfulSyncAt = (this.options.now ?? Date.now)()
        this.setState(this.conflictCount > 0 ? "conflicts" : "idle")
        lastError = undefined
      } catch (error) {
        lastError = error
        this.setState(stateForMobileForegroundError(error))
        if (!this.rerunRequested) {
          throw error
        }
      }
    }
    if (lastError) {
      throw lastError
    }
  }

  private setState(state: MobileForegroundSyncState) {
    this.state = state
    this.options.onStateChange?.(this.snapshot())
  }
}

function stateForMobileForegroundError(error: unknown): MobileForegroundSyncState {
  if (error instanceof MobileApiError && error.status === 401) {
    return "auth-required"
  }
  if (
    (error instanceof MobileNetworkError && error.retryable) ||
    (error instanceof MobileApiError && error.retryable)
  ) {
    return "offline"
  }
  return "idle"
}
