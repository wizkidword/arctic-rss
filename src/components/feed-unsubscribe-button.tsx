"use client"

import { useActionState, useState, type ComponentProps } from "react"
import { Trash2Icon } from "lucide-react"

import {
  unsubscribeFeedAction,
  type UnsubscribeFeedActionState,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

const initialState: UnsubscribeFeedActionState = {
  message: "",
  status: "idle",
}

export function FeedUnsubscribeButton({
  feedTitle,
  subscriptionId,
}: {
  feedTitle: string
  subscriptionId: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(
    unsubscribeFeedAction,
    initialState
  )

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon data-icon="inline-start" />
        Unsubscribe
        <span className="sr-only"> from {feedTitle}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <FeedUnsubscribeDialogContent
          action={action}
          feedTitle={feedTitle}
          pending={pending}
          state={state}
          subscriptionId={subscriptionId}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function FeedUnsubscribeDialogContent({
  action,
  feedTitle,
  pending,
  state,
  subscriptionId,
}: {
  action: ComponentProps<"form">["action"]
  feedTitle: string
  pending: boolean
  state: UnsubscribeFeedActionState
  subscriptionId: string
}) {
  return (
    <form action={action} className="grid gap-4">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Unsubscribe from {feedTitle}?</AlertDialogTitle>
        <AlertDialogDescription>
          The feed will leave your reader. Articles and your read and starred
          history will be preserved.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {state.status === "error" && (
        <p aria-live="polite" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit" variant="destructive">
          <Trash2Icon data-icon="inline-start" />
          {pending ? "Unsubscribing" : "Unsubscribe"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
