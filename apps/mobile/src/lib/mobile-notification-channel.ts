import type { NotificationChannel } from "@arctic-rss/api-contract"

const selectableChannels: readonly Exclude<NotificationChannel, "MOBILE_PUSH">[] = [
  "IN_APP",
  "EMAIL",
  "DISABLED",
]

export function nextMobileNotificationChannel(channel: NotificationChannel) {
  const currentIndex = selectableChannels.indexOf(channel as Exclude<NotificationChannel, "MOBILE_PUSH">)
  return selectableChannels[(currentIndex + 1) % selectableChannels.length]
}

export function mobileNotificationChannelLabel(channel: NotificationChannel) {
  return channel === "MOBILE_PUSH" ? "Mobile push (unavailable)" : channel.replaceAll("_", " ")
}
