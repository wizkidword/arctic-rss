import type { WorkerMode } from "../../worker/mode"

export const RUNTIME_TOPOLOGIES = {
  "all-in-one": {
    chatEnabled: false,
    workerModes: ["all"],
  },
  "all-in-one-with-chat": {
    chatEnabled: true,
    workerModes: ["all"],
  },
  split: {
    chatEnabled: false,
    workerModes: ["ingestion", "ai-mail", "imports", "maintenance"],
  },
  "split-with-chat": {
    chatEnabled: true,
    workerModes: ["ingestion", "ai-mail", "imports", "maintenance", "chat-events"],
  },
} as const satisfies Record<
  string,
  { chatEnabled: boolean; workerModes: readonly WorkerMode[] }
>

export type RuntimeTopologyName = keyof typeof RUNTIME_TOPOLOGIES
export type RuntimeTopology = (typeof RUNTIME_TOPOLOGIES)[RuntimeTopologyName] & {
  name: RuntimeTopologyName
}

type RuntimeTopologyEnvironment = Readonly<Record<string, string | undefined>>

export class RuntimeTopologyConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RuntimeTopologyConfigurationError"
  }
}

export function getRuntimeTopology(
  environment: RuntimeTopologyEnvironment = process.env
): RuntimeTopology {
  const candidate = environment.ARCTIC_RSS_TOPOLOGY?.trim().toLowerCase() || "all-in-one"

  if (candidate in RUNTIME_TOPOLOGIES) {
    const name = candidate as RuntimeTopologyName
    return { name, ...RUNTIME_TOPOLOGIES[name] }
  }

  throw new RuntimeTopologyConfigurationError(
    `ARCTIC_RSS_TOPOLOGY must be one of: ${Object.keys(RUNTIME_TOPOLOGIES).join(", ")}.`
  )
}

export function assertRuntimeTopology(
  environment: RuntimeTopologyEnvironment = process.env
) {
  if (environment.NODE_ENV === "production" && !environment.ARCTIC_RSS_TOPOLOGY?.trim()) {
    throw new RuntimeTopologyConfigurationError(
      "ARCTIC_RSS_TOPOLOGY must be configured in production."
    )
  }

  return getRuntimeTopology(environment)
}
