import {
  getChatFeatureFlags,
  type ChatFeatureFlagEnvironment,
} from "./feature-flags"

export type ExternalIrcNetworkId = "libera" | "oftc"

export type ExternalIrcNetwork = {
  connectionMode: "NETWORK_OPERATED_WEBIRC" | "TLS_TCP"
  featureFlag: "externalLiberaEnabled" | "externalOftcEnabled"
  host: string
  id: ExternalIrcNetworkId
  label: string
  ownerOnly: boolean
  port: number
  publicBetaAllowed: boolean
  tlsRequired: boolean
}

/**
 * This registry is the only future source of external connection targets.
 * Connector code receives a network ID, never a hostname or port from a user.
 */
export const EXTERNAL_IRC_NETWORKS: Record<ExternalIrcNetworkId, ExternalIrcNetwork> = {
  libera: {
    connectionMode: "TLS_TCP",
    featureFlag: "externalLiberaEnabled",
    host: "irc.libera.chat",
    id: "libera",
    label: "Libera.Chat",
    ownerOnly: false,
    port: 6697,
    publicBetaAllowed: false,
    tlsRequired: true,
  },
  oftc: {
    connectionMode: "NETWORK_OPERATED_WEBIRC",
    featureFlag: "externalOftcEnabled",
    host: "webirc.oftc.net",
    id: "oftc",
    label: "OFTC",
    ownerOnly: true,
    port: 8443,
    publicBetaAllowed: false,
    tlsRequired: true,
  },
}

export class ExternalIrcNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExternalIrcNetworkError"
  }
}

export function getExternalIrcNetwork(networkId: string): ExternalIrcNetwork {
  const network = EXTERNAL_IRC_NETWORKS[networkId as ExternalIrcNetworkId]

  if (!network) {
    throw new ExternalIrcNetworkError("That external IRC network is not approved.")
  }

  return network
}

export function isExternalIrcNetworkEnabled(
  networkId: ExternalIrcNetworkId,
  environment: ChatFeatureFlagEnvironment = process.env
) {
  const network = getExternalIrcNetwork(networkId)
  const flags = getChatFeatureFlags(environment)

  return flags.externalEnabled && flags[network.featureFlag]
}

export function listEnabledExternalIrcNetworks(
  environment: ChatFeatureFlagEnvironment = process.env
) {
  return Object.values(EXTERNAL_IRC_NETWORKS).filter((network) =>
    isExternalIrcNetworkEnabled(network.id, environment)
  )
}
