import type { ChatConnectionTokenPayload } from "./session-token"

const TOKEN_REPLAY_NAMESPACE = "arctic-rss:chat:connection-token:v1"

export type ChatTokenReplayStore = {
  set: (
    key: string,
    value: string,
    mode: "PX",
    ttlMilliseconds: number,
    condition: "NX"
  ) => Promise<unknown>
}

export class ChatTokenReplayError extends Error {
  constructor(readonly code: "replayed" | "unavailable") {
    super(
      code === "replayed"
        ? "This chat connection token was already used."
        : "Chat token replay protection is unavailable."
    )
    this.name = "ChatTokenReplayError"
  }
}

export async function consumeChatConnectionToken(
  payload: Pick<ChatConnectionTokenPayload, "exp" | "jti">,
  store: ChatTokenReplayStore,
  now = new Date()
) {
  const nowSeconds = Math.floor(now.getTime() / 1_000)
  const remainingSeconds = payload.exp - nowSeconds

  if (remainingSeconds <= 0) {
    throw new ChatTokenReplayError("replayed")
  }

  try {
    const result = await store.set(
      `${TOKEN_REPLAY_NAMESPACE}:${payload.jti}`,
      "1",
      "PX",
      remainingSeconds * 1_000,
      "NX"
    )

    if (result !== "OK") {
      throw new ChatTokenReplayError("replayed")
    }
  } catch (error) {
    if (error instanceof ChatTokenReplayError) {
      throw error
    }

    throw new ChatTokenReplayError("unavailable")
  }
}
