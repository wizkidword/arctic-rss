import { Worker } from "bullmq"

import { type ManagedWorkerTarget } from "./shutdown"

type WorkerRegistration = {
  name: string
  worker: Worker | undefined
}

/**
 * Keeps BullMQ activity tracking beside the shutdown contract, rather than in
 * the worker bootstrap that defines processors and scheduled work.
 */
export function createManagedWorkerTargets(
  registrations: WorkerRegistration[]
): ManagedWorkerTarget[] {
  return registrations.flatMap(({ name, worker }) =>
    worker
      ? [
          {
            activeJobs: trackActiveJobs(worker),
            name,
            worker,
          },
        ]
      : []
  )
}

export function trackActiveJobs(target: Worker) {
  const activeJobIds = new Set<string>()

  target.on("active", (job) => {
    if (job.id) {
      activeJobIds.add(job.id)
    }
  })
  target.on("completed", (job) => {
    if (job.id) {
      activeJobIds.delete(job.id)
    }
  })
  target.on("failed", (job) => {
    if (job?.id) {
      activeJobIds.delete(job.id)
    }
  })

  return () => [...activeJobIds]
}
