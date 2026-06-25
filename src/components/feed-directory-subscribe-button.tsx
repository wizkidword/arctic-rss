"use client"

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
} from "react"
import { CheckIcon, FolderIcon, RssIcon } from "lucide-react"

import {
  subscribeDirectoryFeedAction,
  type SubscribeDirectoryFeedActionState,
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

const initialState: SubscribeDirectoryFeedActionState = {
  message: "",
  status: "idle",
}

type DirectoryFolder = {
  id: string
  name: string
}

export function FeedDirectorySubscribeButton({
  feedId,
  feedLabel,
  folders,
  subscribed,
}: {
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  subscribed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [openSession, setOpenSession] = useState(0)
  const [announcement, setAnnouncement] = useState({
    feedId: "",
    message: "",
  })
  const closeDialog = useCallback(() => setOpen(false), [])
  const handleActionMessage = useCallback(
    (message: string) => setAnnouncement({ feedId, message }),
    [feedId]
  )
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && !open) {
        setOpenSession((session) => session + 1)
        setAnnouncement({ feedId, message: "" })
      }

      setOpen(nextOpen)
    },
    [feedId, open]
  )

  const liveRegion = (
    <span
      aria-atomic="true"
      aria-live="polite"
      className="sr-only"
    >
      {announcement.feedId === feedId ? announcement.message : ""}
    </span>
  )

  if (subscribed) {
    return (
      <>
        {liveRegion}
        <Button disabled size="sm" variant="secondary">
          <CheckIcon data-icon="inline-start" />
          Subscribed
          <span className="sr-only"> to {feedLabel}</span>
        </Button>
      </>
    )
  }

  return (
    <>
      {liveRegion}
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger
          render={<Button size="sm" variant="outline" />}
        >
          <RssIcon data-icon="inline-start" />
          Subscribe
          <span className="sr-only"> to {feedLabel}</span>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <FeedDirectorySubscribeActionForm
            key={`${feedId}:${openSession}`}
            feedId={feedId}
            feedLabel={feedLabel}
            folders={folders}
            onActionMessage={handleActionMessage}
            onSuccess={closeDialog}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function FeedDirectorySubscribeActionForm({
  feedId,
  feedLabel,
  folders,
  onActionMessage,
  onSuccess,
}: {
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  onActionMessage: (message: string) => void
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(
    subscribeDirectoryFeedAction,
    initialState
  )

  useEffect(() => {
    if (state.status === "error" || state.status === "success") {
      onActionMessage(state.message)
    }

    if (state.status === "success") {
      onSuccess()
    }
  }, [onActionMessage, onSuccess, state.message, state.status])

  return (
    <FeedDirectorySubscribeDialogContent
      action={action}
      feedId={feedId}
      feedLabel={feedLabel}
      folders={folders}
      pending={pending}
      state={state}
    />
  )
}

export function FeedDirectorySubscribeDialogContent({
  action,
  feedId,
  feedLabel,
  folders,
  pending,
  state,
}: {
  action: ComponentProps<"form">["action"]
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  pending: boolean
  state: SubscribeDirectoryFeedActionState
}) {
  const folderSelectId = `directory-feed-folder-${feedId}`

  return (
    <form action={action} className="grid gap-4">
      <input name="directoryFeedId" type="hidden" value={feedId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Subscribe to {feedLabel}</AlertDialogTitle>
        <AlertDialogDescription>
          Choose where this feed should appear in your reader.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor={folderSelectId}>
          Folder
        </label>
        <div className="relative">
          <FolderIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <select
            className="h-8 w-full rounded-lg border border-input bg-background pr-2.5 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            defaultValue=""
            disabled={pending}
            id={folderSelectId}
            name="folderId"
          >
            <option value="">Uncategorized</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-destructive">
        {state.status === "error" ? state.message : ""}
      </p>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit">
          <RssIcon data-icon="inline-start" />
          {pending ? "Subscribing" : "Subscribe"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
