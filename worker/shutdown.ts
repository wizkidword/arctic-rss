export type ManagedWorker = {
  close(force?: boolean): Promise<void>
  pause(doNotWaitActive?: boolean): Promise<void>
}

export type ManagedWorkerTarget = {
  activeJobs(): string[]
  name: string
  worker: ManagedWorker
}

export type WorkerShutdownResult = {
  forced: boolean
  remainingActiveJobs: string[]
}

type SignalSource = {
  once(signal: NodeJS.Signals, listener: () => void): unknown
  removeListener(signal: NodeJS.Signals, listener: () => void): unknown
}

const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000
const MIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 1_000
const MAX_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 120_000

export function getWorkerShutdownTimeoutMs(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const value = environment.WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS?.trim()
  const parsed = value ? Number(value) : DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS

  return Number.isInteger(parsed) &&
    parsed >= MIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS &&
    parsed <= MAX_GRACEFUL_SHUTDOWN_TIMEOUT_MS
    ? parsed
    : DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS
}

/**
 * Stops polling before waiting for in-flight work. A timeout intentionally
 * force-closes BullMQ workers: their durable jobs become stalled and are
 * resumed by a later worker instead of being marked as an application failure.
 */
export async function shutdownWorkerRuntime({
  closeResources,
  disconnectDatabase,
  getPendingWork = () => [],
  log = defaultLog,
  now = Date.now,
  stopScheduling,
  timeoutMs = DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  wait = delay,
  waitIntervalMs = 100,
  workers,
}: {
  closeResources(): Promise<void>
  disconnectDatabase(): Promise<void>
  getPendingWork?(): Promise<unknown>[]
  log?(entry: Record<string, unknown>): void
  now?(): number
  stopScheduling(): void
  timeoutMs?: number
  wait?(milliseconds: number): Promise<void>
  waitIntervalMs?: number
  workers: ManagedWorkerTarget[]
}): Promise<WorkerShutdownResult> {
  const boundedTimeoutMs = Math.min(
    Math.max(Math.trunc(timeoutMs), MIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS),
    MAX_GRACEFUL_SHUTDOWN_TIMEOUT_MS
  )
  const deadline = now() + boundedTimeoutMs
  stopScheduling()
  log({
    activeJobs: activeJobs(workers),
    event: "worker_shutdown",
    outcome: "started",
    timeoutMs: boundedTimeoutMs,
    workers: workers.map((target) => target.name),
  })

  const pauseResults = await Promise.allSettled(
    workers.map((target) => target.worker.pause(true))
  )
  const pauseFailures = pauseResults.filter((result) => result.status === "rejected").length
  const pendingSettled = await settleWithinDeadline(getPendingWork(), deadline, now, wait)
  const activeDrained = pendingSettled && (await waitForActiveJobs(workers, deadline, now, wait, waitIntervalMs))
  let forced = pauseFailures > 0 || !pendingSettled || !activeDrained

  if (forced) {
    const remainingActiveJobs = activeJobs(workers)
    log({
      activeJobs: remainingActiveJobs,
      event: "worker_shutdown",
      outcome: "timed_out",
      pauseFailures,
    })
    await settleWithinDeadline(
      workers.map((target) => target.worker.close(true)),
      deadline,
      now,
      wait
    )
  } else {
    const closed = await settleWithinDeadline(
      workers.map((target) => target.worker.close()),
      deadline,
      now,
      wait
    )
    forced = !closed
  }

  const resourcesClosed = await settleWithinDeadline([closeResources()], deadline, now, wait)
  const databaseDisconnected = await settleWithinDeadline(
    [disconnectDatabase()],
    deadline,
    now,
    wait
  )
  forced ||= !resourcesClosed || !databaseDisconnected

  const remainingActiveJobs = activeJobs(workers)
  log({
    activeJobs: remainingActiveJobs,
    event: "worker_shutdown",
    outcome: forced ? "forced" : "complete",
  })

  return { forced, remainingActiveJobs }
}

export function installWorkerSignalHandlers({
  exit,
  onError = defaultError,
  shutdown,
  signalSource = process,
}: {
  exit(code: number): void
  onError?(error: unknown): void
  shutdown(): Promise<WorkerShutdownResult>
  signalSource?: SignalSource
}) {
  let handling = false
  const handler = () => {
    if (handling) {
      return
    }

    handling = true
    shutdown()
      .then((result) => exit(result.forced ? 1 : 0))
      .catch((error) => {
        onError(error)
        exit(1)
      })
  }

  signalSource.once("SIGINT", handler)
  signalSource.once("SIGTERM", handler)

  return () => {
    signalSource.removeListener("SIGINT", handler)
    signalSource.removeListener("SIGTERM", handler)
  }
}

async function settleWithinDeadline(
  operations: Promise<unknown>[],
  deadline: number,
  now: () => number,
  wait: (milliseconds: number) => Promise<void>
) {
  if (!operations.length) {
    return true
  }

  const settled = Promise.allSettled(operations).then((results) =>
    results.every((result) => result.status === "fulfilled")
  )
  const remaining = deadline - now()
  if (remaining <= 0) {
    void settled
    return false
  }

  return Promise.race([settled, wait(remaining).then(() => false)])
}

async function waitForActiveJobs(
  workers: ManagedWorkerTarget[],
  deadline: number,
  now: () => number,
  wait: (milliseconds: number) => Promise<void>,
  waitIntervalMs: number
) {
  while (activeJobs(workers).length) {
    const remaining = deadline - now()
    if (remaining <= 0) {
      return false
    }

    await wait(Math.min(Math.max(1, waitIntervalMs), remaining))
  }

  return true
}

function activeJobs(workers: ManagedWorkerTarget[]) {
  return workers.flatMap((target) => target.activeJobs().map((jobId) => `${target.name}:${jobId}`))
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function defaultLog(entry: Record<string, unknown>) {
  console.log(JSON.stringify(entry))
}

function defaultError(error: unknown) {
  console.error(error)
}
