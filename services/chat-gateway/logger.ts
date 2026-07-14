export type ChatGatewayLogEvent =
  | "connection_accepted"
  | "connection_rejected"
  | "connection_closed"
  | "startup"
  | "startup_failed"
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
