export type ChatGatewayLogEvent =
  | "connection_accepted"
  | "connection_rejected"
  | "connection_closed"
  | "malformed_event"
  | "malformed_event_disconnect"
  | "operation_limit_rejected"
  | "redis_degraded"
  | "redis_ready"
  | "redis_recovery_exhausted"
  | "security_disconnect"
  | "startup"
  | "startup_failed"
  | "stale_authorization_rejected"
  | "shutdown"

export type ChatGatewayLogger = {
  info: (event: ChatGatewayLogEvent, fields?: Record<string, string>) => void
  warn: (event: ChatGatewayLogEvent, fields?: Record<string, string>) => void
}

export function createChatGatewayLogger(): ChatGatewayLogger {
  return {
    info(event, fields = {}) {
      console.info(JSON.stringify({ event, service: "chat-gateway", ...fields }))
    },
    warn(event, fields = {}) {
      console.warn(JSON.stringify({ event, service: "chat-gateway", ...fields }))
    },
  }
}
