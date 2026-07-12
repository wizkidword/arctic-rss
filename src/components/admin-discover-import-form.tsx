"use client"

import { useActionState } from "react"
import { FileUpIcon, Globe2Icon, TagsIcon, TextIcon } from "lucide-react"

import {
  importDiscoverOpmlAction,
  type ImportDiscoverOpmlActionState,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const initialState: ImportDiscoverOpmlActionState = {
  message: "",
  status: "idle",
}

export function AdminDiscoverImportForm() {
  const [state, action, pending] = useActionState(
    importDiscoverOpmlAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.4fr)] xl:grid-cols-[minmax(0,1fr)_120px_minmax(180px,0.45fr)_minmax(220px,0.7fr)_auto]">
        <Field
          icon={FileUpIcon}
          id="discover-opml-file"
          label="OPML file"
        >
          <Input
            accept=".opml,.xml,application/xml,text/xml"
            disabled={pending}
            id="discover-opml-file"
            name="opmlFile"
            required
            type="file"
          />
        </Field>

        <Field
          icon={Globe2Icon}
          id="discover-country-code"
          label="Country code"
        >
          <Input
            autoCapitalize="characters"
            disabled={pending}
            id="discover-country-code"
            maxLength={2}
            name="countryCode"
            placeholder="US"
          />
        </Field>

        <Field
          icon={TagsIcon}
          id="discover-category-name"
          label="Category"
        >
          <Input
            disabled={pending}
            id="discover-category-name"
            name="categoryName"
            placeholder="General"
          />
        </Field>

        <Field
          icon={TextIcon}
          id="discover-description"
          label="Description"
        >
          <Input
            disabled={pending}
            id="discover-description"
            name="description"
            placeholder="Blank = generated"
          />
        </Field>

        <div className="flex items-end">
          <Button className="w-full" disabled={pending} type="submit">
            <FileUpIcon data-icon="inline-start" />
            {pending ? "Importing" : "Import"}
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

      {state.summary && (
        <dl className="grid gap-3 text-xs sm:grid-cols-5">
          <ImportMetric label="Feeds" value={state.summary.importedFeeds} />
          <ImportMetric label="Failed" value={state.summary.failedFeeds} />
          <ImportMetric
            label="Created"
            value={state.summary.categoriesCreated}
          />
          <ImportMetric
            label="Updated"
            value={state.summary.categoriesUpdated}
          />
          <ImportMetric label="Total" value={state.summary.totalFeeds} />
        </dl>
      )}

      {state.errors?.length ? (
        <ul className="max-h-28 overflow-auto rounded-lg border bg-muted/35 p-3 text-xs text-muted-foreground">
          {state.errors.slice(0, 8).map((error) => (
            <li className="truncate" key={error}>
              {error}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}

function Field({
  children,
  icon: Icon,
  id,
  label,
}: {
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  id: string
  label: string
}) {
  return (
    <div className="grid gap-1.5">
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

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  )
}
