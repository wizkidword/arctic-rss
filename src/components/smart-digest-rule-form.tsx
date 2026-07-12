"use client"

import { useActionState, useState } from "react"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"

import {
  createSmartDigestRuleAction,
  type SmartDigestRuleActionState,
} from "@/app/app/smart-digests/actions"
import { Button } from "@/components/ui/button"
import { TIME_ZONE_OPTIONS } from "@/lib/settings"

const initialState: SmartDigestRuleActionState = {
  message: "",
  status: "idle",
}

export type SmartDigestRuleFormFolder = {
  id: string
  name: string
}

export type SmartDigestRuleFormSubscription = {
  faviconUrl: string | null
  folderId: string | null
  folderName: string | null
  id: string
  title: string
}

type SourceScope = "ALL_FEEDS" | "FOLDERS" | "FEEDS"

export function SmartDigestRuleForm({
  folders,
  subscriptions,
}: {
  folders: SmartDigestRuleFormFolder[]
  subscriptions: SmartDigestRuleFormSubscription[]
}) {
  const [sourceScope, setSourceScope] = useState<SourceScope>("ALL_FEEDS")
  const [state, formAction, pending] = useActionState(
    createSmartDigestRuleAction,
    initialState
  )

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <label className="grid gap-2">
        <span className="text-sm font-medium">Digest name</span>
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          name="name"
          required
          type="text"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Topic</span>
        <textarea
          className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          name="topicPrompt"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Include terms</span>
        <textarea
          className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          name="includeTerms"
          placeholder={'"Iran-U.S. conflict" sanctions nuclear'}
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Exclude terms</span>
        <textarea
          className="min-h-16 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          name="excludeTerms"
          placeholder="sports entertainment"
        />
      </label>

      <fieldset className="grid gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Sources</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sourceScope === "ALL_FEEDS"}
            name="sourceScope"
            onChange={() => setSourceScope("ALL_FEEDS")}
            type="radio"
            value="ALL_FEEDS"
          />
          All active feeds
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sourceScope === "FOLDERS"}
            name="sourceScope"
            onChange={() => setSourceScope("FOLDERS")}
            type="radio"
            value="FOLDERS"
          />
          Selected folders
        </label>
        <div className="grid gap-1 pl-6">
          {folders.map((folder) => (
            <label className="flex items-center gap-2 text-sm" key={folder.id}>
              <input
                disabled={sourceScope !== "FOLDERS"}
                name="folderIds"
                type="checkbox"
                value={folder.id}
              />
              {folder.name}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sourceScope === "FEEDS"}
            name="sourceScope"
            onChange={() => setSourceScope("FEEDS")}
            type="radio"
            value="FEEDS"
          />
          Selected feeds
        </label>
        <div className="grid gap-1 pl-6">
          {subscriptions.map((subscription) => (
            <label
              className="flex min-w-0 items-center gap-2 text-sm"
              key={subscription.id}
            >
              <input
                disabled={sourceScope !== "FEEDS"}
                name="feedSubscriptionIds"
                type="checkbox"
                value={subscription.id}
              />
              <span className="truncate">{subscription.title}</span>
              {subscription.folderName && (
                <span className="text-xs text-muted-foreground">
                  {subscription.folderName}
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Delivery hour</span>
          <input
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            defaultValue={8}
            max={23}
            min={0}
            name="scheduledHour"
            type="number"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Time zone</span>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            defaultValue="UTC"
            name="timeZone"
          >
            {TIME_ZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="emailEnabled" type="checkbox" />
          Email matching digests
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          {pending ? "Saving" : "Create Smart Digest"}
        </Button>
        {state.message && (
          <p
            aria-live="polite"
            className={
              state.status === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
