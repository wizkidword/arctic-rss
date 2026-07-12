"use client"

import { useActionState } from "react"
import { HashIcon, PlusIcon } from "lucide-react"

import {
  addDiscoverSubredditAction,
  type AddDiscoverSubredditActionState,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: AddDiscoverSubredditActionState = {
  message: "",
  status: "idle",
}

export function AdminDiscoverSubredditForm() {
  const [state, action, pending] = useActionState(
    addDiscoverSubredditAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
        <div className="grid gap-1.5">
          <label
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            htmlFor="subreddit-name"
          >
            <HashIcon className="size-3.5" />
            Subreddit
          </label>
          <input
            className={controlClassName}
            disabled={pending}
            id="subreddit-name"
            name="subredditName"
            placeholder="r/localhistory or https://reddit.com/r/localhistory"
            required
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" disabled={pending} type="submit">
            <PlusIcon data-icon="inline-start" />
            {pending ? "Adding" : "Add subreddit"}
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
