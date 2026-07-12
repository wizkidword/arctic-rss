"use client"

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { CheckIcon, FolderIcon, PlusIcon, RssIcon } from "lucide-react"

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
import { trackSourceSubscription } from "@/lib/google-analytics-events"

const initialState: SubscribeDirectoryFeedActionState = {
  message: "",
  status: "idle",
}
const NEW_FOLDER_VALUE = "new-folder"

type DirectoryFolder = {
  id: string
  name: string
}

export function FeedDirectorySubscribeButton({
  feedId,
  feedLabel,
  folders,
  readOnlyReason,
  subscribed,
  subscribedLabel = "Subscribed",
  triggerIcon = "rss",
  triggerLabel = "Subscribe",
  triggerVariant = "outline",
}: {
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  readOnlyReason?: string
  subscribedLabel?: string
  subscribed: boolean
  triggerIcon?: "plus" | "rss"
  triggerLabel?: string
  triggerVariant?: ComponentProps<typeof Button>["variant"]
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
          {subscribedLabel}
          <span className="sr-only"> to {feedLabel}</span>
        </Button>
      </>
    )
  }

  const TriggerIcon = triggerIcon === "plus" ? PlusIcon : RssIcon

  if (readOnlyReason) {
    return (
      <>
        {liveRegion}
        <Button disabled size="sm" title={readOnlyReason} variant={triggerVariant}>
          <TriggerIcon data-icon="inline-start" />
          {triggerLabel}
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
          render={<Button size="sm" variant={triggerVariant} />}
        >
          <TriggerIcon data-icon="inline-start" />
          {triggerLabel}
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
  const trackedSuccessMessageRef = useRef("")

  useEffect(() => {
    if (state.status === "error" || state.status === "success") {
      onActionMessage(state.message)
    }

    if (state.status === "success") {
      if (
        state.analytics &&
        trackedSuccessMessageRef.current !== state.message
      ) {
        trackedSuccessMessageRef.current = state.message
        trackSourceSubscription({
          firstSourceSubscribed: state.analytics.firstSourceSubscribed,
          sourceType: state.analytics.sourceType,
          subscribeSurface: "discover",
        })
      }

      onSuccess()
    }
  }, [onActionMessage, onSuccess, state.analytics, state.message, state.status])

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
  const [folderSelection, setFolderSelection] = useState("")
  const folderSelectId = `directory-feed-folder-${feedId}`
  const folderNameId = `directory-feed-folder-name-${feedId}`
  const isCreatingFolder = folderSelection === NEW_FOLDER_VALUE

  return (
    <form action={action} className="grid gap-4">
      <input name="directoryFeedId" type="hidden" value={feedId} />
      <input
        name="folderId"
        type="hidden"
        value={isCreatingFolder ? "" : folderSelection}
      />
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
            disabled={pending}
            id={folderSelectId}
            onChange={(event) => setFolderSelection(event.currentTarget.value)}
            value={folderSelection}
          >
            <option value="">Uncategorized</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
            <option value={NEW_FOLDER_VALUE}>Create new folder...</option>
          </select>
        </div>
      </div>

      {isCreatingFolder && (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor={folderNameId}>
            New folder name
          </label>
          <input
            autoComplete="off"
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={pending}
            id={folderNameId}
            maxLength={80}
            name="folderName"
            placeholder="Technology"
            required
            type="text"
          />
        </div>
      )}

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
