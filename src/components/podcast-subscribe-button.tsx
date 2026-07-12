"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { RssIcon } from "lucide-react"

import {
  subscribeToPodcastStateAction,
  type PodcastActionState,
} from "@/app/app/podcasts/actions"
import { Button } from "@/components/ui/button"
import { trackSourceSubscription } from "@/lib/google-analytics-events"

const initialState: PodcastActionState = {
  message: "",
  status: "idle",
}

export function PodcastSubscribeButton({
  feedUrl,
  readOnlyReason,
}: {
  feedUrl: string
  readOnlyReason?: string
}) {
  const [state, action] = useActionState(
    subscribeToPodcastStateAction,
    initialState
  )
  const trackedSuccessMessageRef = useRef("")

  useEffect(() => {
    if (
      state.status !== "success" ||
      !state.analytics ||
      trackedSuccessMessageRef.current === state.message
    ) {
      return
    }

    trackedSuccessMessageRef.current = state.message
    trackSourceSubscription({
      firstSourceSubscribed: state.analytics.firstSourceSubscribed,
      sourceType: state.analytics.sourceType,
      subscribeSurface: "podcasts",
    })
  }, [state.analytics, state.message, state.status])

  if (readOnlyReason) {
    return (
      <Button disabled size="sm" title={readOnlyReason} type="button">
        <RssIcon data-icon="inline-start" />
        Subscribe
      </Button>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input name="url" type="hidden" value={feedUrl} />
      <SubmitButton />
      {state.status !== "idle" && (
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
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending} size="sm" type="submit">
      <RssIcon data-icon="inline-start" />
      {pending ? "Subscribing..." : "Subscribe"}
    </Button>
  )
}
