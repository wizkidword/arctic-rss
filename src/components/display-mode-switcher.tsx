"use client"

import { useState, useTransition } from "react"
import {
  BookOpenIcon,
  PanelLeftCloseIcon,
  PanelsTopLeftIcon,
} from "lucide-react"

import { updateDisplayMode } from "@/app/app/actions"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  DISPLAY_MODE_OPTIONS,
  displayModeDescriptions,
  displayModeLabels,
  isDisplayMode,
  type DisplayMode,
} from "@/lib/settings"

const displayModeIcons = {
  MINIMAL: PanelLeftCloseIcon,
  READER: BookOpenIcon,
  THREE_PANE: PanelsTopLeftIcon,
} satisfies Record<DisplayMode, React.ComponentType<{ className?: string }>>

export function DisplayModeSwitcher({
  displayMode,
}: {
  displayMode: DisplayMode
}) {
  const [value, setValue] = useState<DisplayMode>(displayMode)
  const [pending, startTransition] = useTransition()

  function onValueChange(nextValues: string[]) {
    const nextDisplayMode = nextValues[0]

    if (!isDisplayMode(nextDisplayMode)) {
      return
    }

    setValue(nextDisplayMode)
    startTransition(() => {
      void updateDisplayMode(nextDisplayMode)
    })
  }

  return (
    <ToggleGroup
      aria-label="Reader display mode"
      className="grid w-full gap-2 md:grid-cols-3"
      disabled={pending}
      onValueChange={onValueChange}
      spacing={1}
      value={[value]}
      variant="outline"
    >
      {DISPLAY_MODE_OPTIONS.map((option) => {
        const Icon = displayModeIcons[option]

        return (
          <ToggleGroupItem
            aria-label={`Use ${displayModeLabels[option]} display mode`}
            className="h-auto min-h-24 w-full justify-start whitespace-normal p-3 text-left"
            key={option}
            value={option}
          >
            <span className="flex min-w-0 flex-col gap-2">
              <span className="flex items-center gap-2 font-medium">
                <Icon data-icon="inline-start" />
                {displayModeLabels[option]}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {displayModeDescriptions[option]}
              </span>
            </span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
