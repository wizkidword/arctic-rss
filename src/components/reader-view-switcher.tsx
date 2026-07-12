"use client"

import { useState, useTransition } from "react"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  DEFAULT_VIEW,
  VIEW_OPTIONS,
  isDefaultView,
  type DefaultView,
  viewOptionLabels,
} from "@/lib/preferences"
import { updateDefaultView } from "@/app/app/actions"

export function ReaderViewSwitcher({
  defaultView,
}: {
  defaultView: DefaultView
}) {
  const [value, setValue] = useState<DefaultView>(defaultView || DEFAULT_VIEW)
  const [pending, startTransition] = useTransition()

  function onValueChange(nextValues: string[]) {
    const nextView = nextValues[0]

    if (!isDefaultView(nextView)) {
      return
    }

    setValue(nextView)
    startTransition(() => {
      void updateDefaultView(nextView)
    })
  }

  return (
    <ToggleGroup
      aria-label="Reader view"
      disabled={pending}
      onValueChange={onValueChange}
      spacing={1}
      value={[value]}
      variant="outline"
    >
      {VIEW_OPTIONS.map((option) => (
        <ToggleGroupItem key={option} value={option}>
          {viewOptionLabels[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
