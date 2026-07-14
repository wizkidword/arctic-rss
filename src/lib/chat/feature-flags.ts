export type ChatFeatureFlagEnvironment = Readonly<
  Record<string, string | undefined>
>

export type ChatFeatureFlags = {
  betaAllowlistEnabled: boolean
  botEnabled: boolean
  directMessagesEnabled: boolean
  enabled: boolean
  externalEnabled: boolean
  externalLiberaEnabled: boolean
  externalOftcEnabled: boolean
  guestPreviewEnabled: boolean
  roomCreationEnabled: boolean
}

export function parseChatFeatureFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function getChatFeatureFlags(
  environment: ChatFeatureFlagEnvironment = process.env
): ChatFeatureFlags {
  const enabled = parseChatFeatureFlag(environment.ARCTIC_IRC_ENABLED)

  return {
    betaAllowlistEnabled: enabled && parseChatFeatureFlag(
      environment.ARCTIC_IRC_BETA_ALLOWLIST_ENABLED
    ),
    botEnabled: enabled && parseChatFeatureFlag(environment.ARCTIC_IRC_BOT_ENABLED),
    directMessagesEnabled: enabled && parseChatFeatureFlag(
      environment.ARCTIC_IRC_DMS_ENABLED
    ),
    enabled,
    externalEnabled: enabled && parseChatFeatureFlag(
      environment.ARCTIC_IRC_EXTERNAL_ENABLED
    ),
    externalLiberaEnabled:
      enabled &&
      parseChatFeatureFlag(environment.ARCTIC_IRC_EXTERNAL_ENABLED) &&
      parseChatFeatureFlag(environment.ARCTIC_IRC_EXTERNAL_LIBERA_ENABLED),
    externalOftcEnabled:
      enabled &&
      parseChatFeatureFlag(environment.ARCTIC_IRC_EXTERNAL_ENABLED) &&
      parseChatFeatureFlag(environment.ARCTIC_IRC_EXTERNAL_OFTC_ENABLED),
    guestPreviewEnabled: enabled && parseChatFeatureFlag(
      environment.ARCTIC_IRC_GUEST_PREVIEW_ENABLED
    ),
    roomCreationEnabled: enabled && parseChatFeatureFlag(
      environment.ARCTIC_IRC_ROOM_CREATION_ENABLED
    ),
  }
}

export function isChatEnabled(
  environment: ChatFeatureFlagEnvironment = process.env
) {
  return getChatFeatureFlags(environment).enabled
}
