import { MonitorCogIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DateTimePreferenceControls } from "@/components/date-time-preference-controls"
import { DisplayModeSwitcher } from "@/components/display-mode-switcher"
import { ThemePreferenceSwitcher } from "@/components/theme-preference-switcher"
import { Badge } from "@/components/ui/badge"
import {
  normalizeDateTimePreferences,
  normalizeDisplayMode,
  normalizeThemePreference,
} from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const settings = await getOrCreateUserSettings(session.user.id)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const themePreference = normalizeThemePreference(settings.theme)
  const dateTimePreferences = normalizeDateTimePreferences(settings)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <MonitorCogIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">
              Reader Settings
            </h1>
            <Badge variant="secondary">Preferences</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tune Arctic RSS for the way you read.
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-base font-medium">Display mode</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose the reader structure that fits the moment.
          </p>
        </div>
        <DisplayModeSwitcher displayMode={displayMode} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-base font-medium">Appearance</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose a light reader, a dark reader, or follow your device setting.
          </p>
        </div>
        <ThemePreferenceSwitcher themePreference={themePreference} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-base font-medium">Date & time</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Set how article timestamps appear throughout the reader.
          </p>
        </div>
        <DateTimePreferenceControls preferences={dateTimePreferences} />
      </section>
    </div>
  )
}
