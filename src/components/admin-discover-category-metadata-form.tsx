"use client"

import { useActionState, useMemo, useState } from "react"
import { PaletteIcon, SaveIcon, TagsIcon, TextIcon } from "lucide-react"

import {
  updateDiscoverCategoryMetadataAction,
  type UpdateDiscoverCategoryMetadataActionState,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import type { DiscoverCategoryEditorOption } from "@/lib/discover-category-customizations"
import { discoverCategoryIconOptions } from "@/lib/discover-category-icons"
import { cn } from "@/lib/utils"

const initialState: UpdateDiscoverCategoryMetadataActionState = {
  message: "",
  status: "idle",
}

export function AdminDiscoverCategoryMetadataForm({
  categories,
}: {
  categories: DiscoverCategoryEditorOption[]
}) {
  const [state, action, pending] = useActionState(
    updateDiscoverCategoryMetadataAction,
    initialState
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories[0]?.id ?? ""
  )
  const selectedCategory = useMemo(
    () =>
      categories.find((category) => category.id === selectedCategoryId) ??
      categories[0],
    [categories, selectedCategoryId]
  )

  if (!selectedCategory) {
    return (
      <div className="flex min-h-24 items-center justify-center px-4 py-8 text-sm text-muted-foreground">
        No Discover cards available.
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          icon={TagsIcon}
          id="discover-category-card"
          label="Category card"
        >
          <select
            className={controlClassName}
            disabled={pending}
            id="discover-category-card"
            name="categoryId"
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            value={selectedCategory.id}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          className="sm:col-span-2"
          icon={TextIcon}
          id="discover-category-description"
          label="Description"
        >
          <textarea
            className={cn(controlClassName, "min-h-20 resize-y py-2")}
            defaultValue={selectedCategory.description}
            disabled={pending}
            id="discover-category-description"
            key={`${selectedCategory.id}-description`}
            maxLength={300}
            name="description"
            required
          />
        </Field>

        <Field
          icon={PaletteIcon}
          id="discover-category-icon"
          label="Icon"
        >
          <select
            className={controlClassName}
            defaultValue={selectedCategory.iconKey}
            disabled={pending}
            id="discover-category-icon"
            key={`${selectedCategory.id}-icon`}
            name="iconKey"
          >
            {discoverCategoryIconOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end sm:col-span-2">
          <Button className="w-full" disabled={pending} type="submit">
            <SaveIcon data-icon="inline-start" />
            {pending ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          state.status === "error" && "text-destructive",
          state.status === "success" && "text-muted-foreground"
        )}
      >
        {state.message}
      </p>
    </form>
  )
}

const controlClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"

function Field({
  className,
  children,
  icon: Icon,
  id,
  label,
}: {
  className?: string
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  id: string
  label: string
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        htmlFor={id}
      >
        <Icon className="size-3.5" />
        {label}
      </label>
      {children}
    </div>
  )
}
