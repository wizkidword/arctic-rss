import { isIP } from "node:net"

import {
  getExternalIrcNetwork,
  type ExternalIrcNetwork,
  type ExternalIrcNetworkId,
} from "./external-networks"

export class ExternalIrcEgressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExternalIrcEgressError"
  }
}

export async function resolveApprovedExternalIrcTarget({
  networkId,
  resolve,
}: {
  networkId: ExternalIrcNetworkId
  resolve: (host: string) => Promise<readonly string[]>
}): Promise<ExternalIrcNetwork & { addresses: string[] }> {
  const network = getExternalIrcNetwork(networkId)
  const addresses = [...new Set(await resolve(network.host))]

  if (!addresses.length || addresses.some((address) => !isPublicIrcEgressAddress(address))) {
    throw new ExternalIrcEgressError("External IRC endpoint resolved to an unsafe address.")
  }

  return { ...network, addresses }
}

export function isPublicIrcEgressAddress(address: string) {
  const version = isIP(address)

  if (version === 4) {
    const octets = address.split(".").map(Number)
    const [first, second] = octets

    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19))
    )
  }

  if (version === 6) {
    const normalized = address.toLowerCase()

    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("::ffff:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("2001:db8")
    )
  }

  return false
}
