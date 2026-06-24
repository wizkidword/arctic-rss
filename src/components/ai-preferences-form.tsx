"use client"

import { useActionState } from "react"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"

import {
  updateAiPreferencesAction,
  type UpdateAiPreferencesActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: UpdateAiPreferencesActionState = {
  message: "",
  status: "idle",
}

export function AiPreferencesForm({
  aiAutoSummariesEnabled,
  dailyDigestEnabled,
}: {
  aiAutoSummariesEnabled: boolean
  dailyDigestEnabled: boolean
}) {
  const [state, formAction, pending] = useActionState(
    updateAiPreferencesAction,
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="divide-y rounded-lg border">
        <label className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 p-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Automatic article summaries
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Generate a summary when new articles are processed.
            </span>
          </span>
          <input
            className="size-4 accent-primary"
            defaultChecked={aiAutoSummariesEnabled}
            name="aiAutoSummariesEnabled"
            type="checkbox"
          />
        </label>
        <label className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 p-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">Daily digest</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Save this preference for scheduled delivery in a later milestone.
            </span>
          </span>
          <input
            className="size-4 accent-primary"
            defaultChecked={dailyDigestEnabled}
            name="dailyDigestEnabled"
            type="checkbox"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          {pending ? "Saving" : "Save preferences"}
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
