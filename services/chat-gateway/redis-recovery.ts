export type GatewayRedisClient = {
  connect: () => Promise<unknown>
  disconnect: () => void
  on: (event: "close" | "end" | "error" | "ready" | "reconnecting", listener: () => void) => unknown
  ping: () => Promise<unknown>
  quit: () => Promise<unknown>
}

export type RedisRecoveryState = {
  degradedSince: number | null
  ready: boolean
  reconnectCount: number
}

const CLIENT_NAMES = [
  "command",
  "adapterPublisher",
  "adapterSubscriber",
  "blockEvents",
  "roomEvents",
  "securityEvents",
] as const

type ClientName = (typeof CLIENT_NAMES)[number]

export function createRedisRecoverySupervisor({
  clients,
  gracePeriodMs,
  onDegradedTimeout,
  onStateChange = () => {},
  resubscribe,
}: {
  clients: Record<ClientName, GatewayRedisClient>
  gracePeriodMs: number
  onDegradedTimeout: () => void
  onStateChange?: (state: RedisRecoveryState) => void
  resubscribe: () => Promise<void>
}) {
  let closed = false
  let degradedSince: number | null = null
  let ready = false
  let reconnectCount = 0
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let resubscribePromise: Promise<void> | undefined
  let acceptsReadyEvents = false
  const connected = new Set<ClientName>()

  for (const name of CLIENT_NAMES) {
    const client = clients[name]
    client.on("ready", () => {
      if (acceptsReadyEvents) {
        void markClientReady(name)
      }
    })
    client.on("close", () => markClientUnavailable())
    client.on("end", () => markClientUnavailable())
    client.on("error", () => markClientUnavailable())
    client.on("reconnecting", () => {
      reconnectCount += 1
      markClientUnavailable()
    })
  }

  async function start() {
    await Promise.all(CLIENT_NAMES.map((name) => clients[name].connect()))
    await Promise.all(CLIENT_NAMES.map((name) => clients[name].ping()))
    CLIENT_NAMES.forEach((name) => connected.add(name))
    await resubscribeClients()
    acceptsReadyEvents = true
    updateState()
  }

  async function markClientReady(name: ClientName) {
    if (closed) {
      return
    }

    connected.add(name)
    if (connected.size !== CLIENT_NAMES.length) {
      return
    }

    try {
      await resubscribeClients()
    } catch {
      markClientUnavailable()
      return
    }
    updateState()
  }

  function markClientUnavailable() {
    if (closed) {
      return
    }

    connected.clear()
    updateState()
  }

  function resubscribeClients() {
    if (!resubscribePromise) {
      resubscribePromise = resubscribe().finally(() => {
        resubscribePromise = undefined
      })
    }

    return resubscribePromise
  }

  function updateState() {
    const nextReady = connected.size === CLIENT_NAMES.length && !resubscribePromise
    if (nextReady === ready) {
      return
    }

    ready = nextReady
    if (ready) {
      degradedSince = null
      if (watchdog) {
        clearTimeout(watchdog)
        watchdog = undefined
      }
    } else if (degradedSince === null) {
      degradedSince = Date.now()
      watchdog = setTimeout(() => {
        if (!closed && !ready) {
          onDegradedTimeout()
        }
      }, gracePeriodMs)
      watchdog.unref?.()
    }

    onStateChange({ degradedSince, ready, reconnectCount })
  }

  return {
    close: async () => {
      closed = true
      if (watchdog) {
        clearTimeout(watchdog)
      }
      await Promise.all(CLIENT_NAMES.map((name) => clients[name].quit().catch(() => {
        clients[name].disconnect()
      })))
    },
    getState: (): RedisRecoveryState => ({ degradedSince, ready, reconnectCount }),
    isReady: () => ready,
    start,
  }
}
