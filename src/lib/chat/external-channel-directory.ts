/**
 * Curated external IRC links for the public chat directory.
 *
 * These are ordinary links to third-party web clients. They do not use the
 * external connector registry and must never cause Arctic infrastructure to
 * establish an IRC connection.
 */
export type ExternalIrcChannelRecommendation = {
  channel: string
  connectionHint?: string
  description: string
  id: string
  network: "Libera.Chat" | "OFTC"
  openUrl: string
  sourceLabel: string
  sourceUrl: string
  title: string
}

const EXTERNAL_IRC_CHANNEL_RECOMMENDATIONS: readonly ExternalIrcChannelRecommendation[] = [
  {
    channel: "#libera",
    description: "Libera.Chat's main help channel for questions about using the network.",
    id: "libera-support",
    network: "Libera.Chat",
    openUrl: "https://web.libera.chat/#libera",
    sourceLabel: "Libera.Chat help information",
    sourceUrl: "https://libera.chat/guides/faq",
    title: "Libera.Chat support",
  },
  {
    channel: "#oftc",
    connectionHint: "After connecting, enter /join #oftc.",
    description: "OFTC's public network-support channel.",
    id: "oftc-support",
    network: "OFTC",
    openUrl: "https://webchat.oftc.net/",
    sourceLabel: "OFTC web chat information",
    sourceUrl: "https://www.oftc.net/WebChat/",
    title: "OFTC support",
  },
  {
    channel: "#debian",
    connectionHint: "After connecting, enter /join #debian.",
    description: "English-language help for Debian users on the OFTC network.",
    id: "debian-support",
    network: "OFTC",
    openUrl: "https://webchat.oftc.net/",
    sourceLabel: "Debian IRC information",
    sourceUrl: "https://wiki.debian.org/IRC",
    title: "Debian user support",
  },
]

export function listExternalIrcChannelRecommendations(search = "") {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return EXTERNAL_IRC_CHANNEL_RECOMMENDATIONS
  }

  return EXTERNAL_IRC_CHANNEL_RECOMMENDATIONS.filter((channel) =>
    [channel.channel, channel.description, channel.network, channel.title]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  )
}
