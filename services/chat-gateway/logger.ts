export type ChatGatewayLogEvent =
  | "connection_accepted"
  | "connection_rejected"
  | "connection_closed"
  | "malformed_event"
  | "malformed_event_disconnect"
  | "limiter_accounting_failed"
  | "operation_limit_rejected"
  | "pending_admission_expired"
  | "pending_admission_metrics"
  | "presence_metrics"
  | "presence_refresh_failed"
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
