import Link from "next/link"
import { BellRingIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { requireFreshUser } from "@/lib/authorization"
import {
  MOBILE_NOTIFICATION_CHANNELS,
  listMobileNotificationPreferences,
} from "@/lib/mobile-sync"

import { updateNotificationPreferenceAction } from "./actions"

const topicLabels: Record<string, string> = {
  CHAT_MENTIONS: "Future chat mentions",
  SAVED_MONITOR_MATCHES: "Saved-monitor matches",
  SECURITY_ALERTS: "Security alerts",
  SMART_DIGEST_COMPLETION: "Smart Digest completion",
}

const channelLabels: Record<string, string> = {
  DISABLED: "Disabled",
  EMAIL: "Email",
  IN_APP: "In-app",
  MOBILE_PUSH: "Mobile push",
}

export default async function NotificationSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }
  const user = await requireFreshUser(session)
  const preferences = await listMobileNotificationPreferences(user.id)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <BellRingIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">Notifications</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose one central delivery channel for each Arctic RSS notification type.
          </p>
        </div>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/app/settings">
          Back to reader settings
        </Link>
      </section>

      <section className="divide-y rounded-lg border bg-card">
        {preferences.map((preference) => (
          <form
            action={updateNotificationPreferenceAction}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={preference.topic}
          >
            <div>
              <h2 className="font-heading text-base font-medium">{topicLabels[preference.topic]}</h2>
              <p className="text-sm text-muted-foreground">
                Delivery integrations remain opt-in; a mobile push choice only records the
                preference until a reviewed push provider is enabled.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input name="topic" type="hidden" value={preference.topic} />
              <select
                aria-label={`${topicLabels[preference.topic]} delivery channel`}
                className="rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={preference.channel}
                name="channel"
              >
                {MOBILE_NOTIFICATION_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channelLabels[channel]}
                  </option>
                ))}
              </select>
              <button className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" type="submit">
                Save
              </button>
            </div>
          </form>
        ))}
      </section>
    </div>
  )
}
