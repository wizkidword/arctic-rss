"use client"

import { type ReactNode, useState, useTransition } from "react"

import { updateDateTimePreferences } from "@/app/app/actions"
import {
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  TIME_ZONE_OPTIONS,
  dateFormatPreferenceLabels,
  isDateFormatPreference,
  isSupportedTimeZone,
  isTimeFormatPreference,
  timeFormatPreferenceLabels,
  type DateTimePreferences,
} from "@/lib/settings"

export function DateTimePreferenceControls({
  preferences,
}: {
  preferences: DateTimePreferences
}) {
  const [value, setValue] = useState(preferences)
  const [pending, startTransition] = useTransition()

  function save(nextValue: DateTimePreferences) {
    setValue(nextValue)
    startTransition(() => {
      void updateDateTimePreferences(nextValue)
    })
  }

  function onDateFormatChange(nextDateFormat: string) {
    if (!isDateFormatPreference(nextDateFormat)) {
      return
    }

    save({
      ...value,
      dateFormat: nextDateFormat,
    })
  }

  function onTimeFormatChange(nextTimeFormat: string) {
    if (!isTimeFormatPreference(nextTimeFormat)) {
      return
    }

    save({
      ...value,
      timeFormat: nextTimeFormat,
    })
  }

  function onTimeZoneChange(nextTimeZone: string) {
    if (!isSupportedTimeZone(nextTimeZone)) {
      return
    }

    save({
      ...value,
      timeZone: nextTimeZone,
    })
  }

  return (
    <div className="grid gap-3">
      <PreferenceSelect label="Date format">
        <select
          aria-label="Date format"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          onChange={(event) => onDateFormatChange(event.currentTarget.value)}
          value={value.dateFormat}
        >
          {DATE_FORMAT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {dateFormatPreferenceLabels[option]}
            </option>
          ))}
        </select>
      </PreferenceSelect>

      <PreferenceSelect label="Time format">
        <select
          aria-label="Time format"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          onChange={(event) => onTimeFormatChange(event.currentTarget.value)}
          value={value.timeFormat}
        >
          {TIME_FORMAT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {timeFormatPreferenceLabels[option]}
            </option>
          ))}
        </select>
      </PreferenceSelect>

      <PreferenceSelect label="Time zone">
        <select
          aria-label="Time zone"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          onChange={(event) => onTimeZoneChange(event.currentTarget.value)}
          value={value.timeZone}
        >
          {TIME_ZONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </PreferenceSelect>
    </div>
  )
}

function PreferenceSelect({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-center">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
