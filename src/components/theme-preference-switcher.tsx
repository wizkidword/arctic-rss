"use client"

import { useState, useTransition } from "react"
import {
  CheckIcon,
  ListIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react"

import { updateThemePreference } from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  READER_THEME_OPTIONS,
  isThemePreference,
  type ReaderThemePreference,
  type ThemePreference,
  themePreferenceLabels,
} from "@/lib/settings"
import { applyThemePreferenceToDocument } from "@/lib/theme-dom"
import { cn } from "@/lib/utils"

const themePreviewPalettes = {
  DARK: {
    accent: "#f8fafc",
    background: "#151515",
    border: "#343434",
    count: "#7ddf64",
    muted: "#262626",
    row: "#1d1d1d",
    text: "#f8fafc",
  },
  GREY: {
    accent: "#f1f5f9",
    background: "#4b4d52",
    border: "#62646b",
    count: "#7ddf64",
    muted: "#5b5d63",
    row: "#55575d",
    text: "#f8fafc",
  },
  HOLIDAY: {
    accent: "#ef4444",
    background: "#fff7f7",
    border: "#f2b8b8",
    count: "#4d9a24",
    muted: "#ffecec",
    row: "#fffafa",
    text: "#111827",
  },
  LIGHT: {
    accent: "#6b7280",
    background: "#ffffff",
    border: "#d8dee8",
    count: "#4d9a24",
    muted: "#f1f5f9",
    row: "#f8fafc",
    text: "#111827",
  },
  ORANGE: {
    accent: "#f97316",
    background: "#fffaf4",
    border: "#fed7aa",
    count: "#4d9a24",
    muted: "#fff1dc",
    row: "#fff7ed",
    text: "#1f2937",
  },
  SAND: {
    accent: "#1f2340",
    background: "#f8efd8",
    border: "#e4d6b8",
    count: "#4d9a24",
    muted: "#efe3c8",
    row: "#fbf4e3",
    text: "#1f2340",
  },
} satisfies Record<
  ReaderThemePreference,
  {
    accent: string
    background: string
    border: string
    count: string
    muted: string
    row: string
    text: string
  }
>

export function ThemePreferenceSwitcher({
  themePreference,
}: {
  themePreference: ThemePreference
}) {
  const [value, setValue] = useState<ThemePreference>(themePreference)
  const [pending, startTransition] = useTransition()

  function setTheme(nextTheme: ThemePreference) {
    setValue(nextTheme)
    applyThemePreferenceToDocument(nextTheme)
    startTransition(() => {
      void updateThemePreference(nextTheme)
    })
  }

  function onValueChange(nextValues: string[]) {
    const nextTheme = nextValues[0]

    if (!isThemePreference(nextTheme) || nextTheme === "SYSTEM") {
      return
    }

    setTheme(nextTheme)
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        aria-pressed={value === "SYSTEM"}
        className="h-auto w-fit justify-start gap-3 px-3 py-2"
        disabled={pending}
        onClick={() => setTheme("SYSTEM")}
        type="button"
        variant="ghost"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative h-6 w-11 rounded-full border bg-muted transition-colors",
            value === "SYSTEM" && "border-primary bg-primary"
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition-transform",
              value === "SYSTEM" && "translate-x-5 text-primary"
            )}
          >
            {value === "SYSTEM" ? <CheckIcon className="size-3" /> : null}
          </span>
        </span>
        Follow OS setting
      </Button>

      <ToggleGroup
        aria-label="Reader theme"
        className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3"
        disabled={pending}
        onValueChange={onValueChange}
        spacing={1}
        value={value === "SYSTEM" ? [] : [value]}
        variant="outline"
      >
        {READER_THEME_OPTIONS.map((option) => (
          <ToggleGroupItem
            aria-label={`Use ${themePreferenceLabels[option]} theme`}
            className="h-auto min-h-36 w-full justify-start whitespace-normal p-2 text-left aria-pressed:border-primary aria-pressed:bg-muted/70 aria-pressed:ring-2 aria-pressed:ring-ring/40"
            key={option}
            value={option}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <ThemePreview theme={option} />
              <span className="flex items-center gap-2 px-1 font-medium">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border",
                    value === option
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {value === option ? <CheckIcon className="size-3" /> : null}
                </span>
                {themePreferenceLabels[option]}
              </span>
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function ThemePreview({ theme }: { theme: ReaderThemePreference }) {
  const palette = themePreviewPalettes[theme]

  return (
    <span
      aria-hidden="true"
      className="block overflow-hidden rounded-md border"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <span className="grid h-7 grid-cols-[34px_1fr_34px]">
        <span
          className="flex items-center justify-center"
          style={{ backgroundColor: palette.muted }}
        >
          <SettingsIcon className="size-3.5" style={{ color: palette.accent }} />
        </span>
        <span className="flex items-center gap-2 px-2">
          <ListIcon className="size-3.5" style={{ color: palette.accent }} />
          <StarIcon className="size-3.5" style={{ color: palette.accent }} />
          <span
            className="rounded px-1 text-[9px] font-semibold leading-4"
            style={{
              backgroundColor: palette.background,
              color: palette.accent,
            }}
          >
            159
          </span>
        </span>
        <span
          className="flex items-center justify-center"
          style={{ color: palette.accent }}
        >
          <PlusIcon className="size-3.5" />
        </span>
      </span>
      <span className="grid gap-px p-2">
        {[14, 3, 0].map((count, index) => (
          <span
            className="grid h-5 grid-cols-[18px_1fr_20px] items-center gap-2 rounded-sm px-1"
            key={`${theme}-${count}-${index}`}
            style={{
              backgroundColor: index === 1 ? palette.muted : palette.row,
            }}
          >
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: palette.border }}
            />
            <span
              className="h-1.5 rounded-full"
              style={{ backgroundColor: palette.border }}
            />
            <span
              className="text-right text-[9px] font-medium"
              style={{ color: palette.count }}
            >
              {count || ""}
            </span>
          </span>
        ))}
      </span>
      <span className="sr-only">{themePreferenceLabels[theme]} preview</span>
    </span>
  )
}
