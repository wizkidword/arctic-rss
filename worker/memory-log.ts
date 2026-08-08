import { getHeapStatistics } from "node:v8"

export type WorkerMemoryLogContext = {
  jobId?: string
  outcome?: string
  trigger: "startup" | "interval" | "opml_import"
}

export function logWorkerMemory(context: WorkerMemoryLogContext) {
  const memory = process.memoryUsage()

  console.log(
    JSON.stringify({
      event: "worker_memory",
      ...context,
      arrayBuffersMb: megabytes(memory.arrayBuffers),
      externalMb: megabytes(memory.external),
      heapLimitMb: megabytes(getHeapStatistics().heap_size_limit),
      heapTotalMb: megabytes(memory.heapTotal),
      heapUsedMb: megabytes(memory.heapUsed),
      rssMb: megabytes(memory.rss),
    })
  )
}

function megabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}
