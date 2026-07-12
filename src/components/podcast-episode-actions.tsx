"use client"

import {
  type ComponentProps,
  type ReactNode,
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react"
import {
  CheckCircle2,
  Circle,
  FolderPlus,
  Share2,
  Star,
  Trash2,
} from "lucide-react"

import {
  addPodcastEpisodeToCollectionAction,
  type AddPodcastEpisodeToCollectionActionState,
  removePodcastEpisodeFromCollectionAction,
} from "@/app/app/actions"
import {
  markPodcastEpisodePlayedAction,
  togglePodcastEpisodeStarAction,
} from "@/app/app/podcasts/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  type ArticleCollectionPickerItem,
} from "@/lib/article-collections"
import { cn } from "@/lib/utils"

export type PodcastEpisodeActionItem = {
  episodeId: string
  isPlayed: boolean
  isStarred: boolean
  title: string
  url: string | null
}

export type PodcastEpisodeActionCollection = {
  id: string
  name: string
}

const NEW_COLLECTION_VALUE = "new-collection"
const collectionInitialState: AddPodcastEpisodeToCollectionActionState = {
  message: "",
  status: "idle",
}

export function PodcastEpisodeActions({
  collections,
  currentCollection,
  episode,
}: {
  collections: ArticleCollectionPickerItem[]
  currentCollection?: PodcastEpisodeActionCollection
  episode: PodcastEpisodeActionItem
}) {
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [collectionOpenSession, setCollectionOpenSession] = useState(0)
  const [, startTransition] = useTransition()
  const closeCollectionDialog = useCallback(
    () => setCollectionDialogOpen(false),
    []
  )

  function togglePlayed() {
    startTransition(() => {
      const formData = new FormData()
      formData.set("episodeId", episode.episodeId)
      formData.set("isPlayed", episode.isPlayed ? "false" : "true")
      void markPodcastEpisodePlayedAction(formData)
    })
  }

  function toggleStarred() {
    startTransition(() => {
      const formData = new FormData()
      formData.set("episodeId", episode.episodeId)
      void togglePodcastEpisodeStarAction(formData)
    })
  }

  function openCollectionDialog() {
    setCollectionOpenSession((session) => session + 1)
    setCollectionDialogOpen(true)
  }

  function removeFromCurrentCollection() {
    if (!currentCollection) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("episodeId", episode.episodeId)
      formData.set("collectionId", currentCollection.id)
      void removePodcastEpisodeFromCollectionAction(formData)
    })
  }

  async function shareEpisode() {
    if (!episode.url) {
      return
    }

    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({
          title: episode.title,
          url: episode.url,
        })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(episode.url)
      }
    } catch {
      // Native share and clipboard can be blocked by browser permissions.
    }
  }

  return (
    <>
      <div
        aria-label={`${episode.title} actions`}
        className="flex shrink-0 items-center gap-1"
        role="toolbar"
      >
        <EpisodeActionButton
          label="Share episode"
          onClick={() => {
            void shareEpisode()
          }}
        >
          <Share2 />
        </EpisodeActionButton>
        <EpisodeActionButton
          label={episode.isStarred ? "Unstar episode" : "Star episode"}
          onClick={toggleStarred}
        >
          <Star className={cn(episode.isStarred && "fill-current")} />
        </EpisodeActionButton>
        <EpisodeActionButton
          label="Save episode to collection"
          onClick={openCollectionDialog}
        >
          <FolderPlus />
        </EpisodeActionButton>
        {currentCollection ? (
          <EpisodeActionButton
            label={`Remove from ${currentCollection.name}`}
            onClick={removeFromCurrentCollection}
          >
            <Trash2 />
          </EpisodeActionButton>
        ) : null}
        <EpisodeActionButton
          label={
            episode.isPlayed ? "Mark episode unplayed" : "Mark episode played"
          }
          onClick={togglePlayed}
        >
          {episode.isPlayed ? (
            <Circle />
          ) : (
            <CheckCircle2 className={cn(episode.isPlayed && "fill-current")} />
          )}
        </EpisodeActionButton>
      </div>
      <AlertDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
      >
        <AlertDialogContent>
          <PodcastEpisodeCollectionActionForm
            collections={collections}
            episodeId={episode.episodeId}
            key={`${episode.episodeId}:${collectionOpenSession}`}
            onSuccess={closeCollectionDialog}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EpisodeActionButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function PodcastEpisodeCollectionActionForm({
  collections,
  episodeId,
  onSuccess,
}: {
  collections: ArticleCollectionPickerItem[]
  episodeId: string
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(
    addPodcastEpisodeToCollectionAction,
    collectionInitialState
  )

  useEffect(() => {
    if (state.status === "success") {
      onSuccess()
    }
  }, [onSuccess, state.status])

  return (
    <PodcastEpisodeCollectionDialogContent
      action={action}
      collections={collections}
      episodeId={episodeId}
      pending={pending}
      state={state}
    />
  )
}

function PodcastEpisodeCollectionDialogContent({
  action,
  collections,
  episodeId,
  pending,
  state,
}: {
  action: ComponentProps<"form">["action"]
  collections: ArticleCollectionPickerItem[]
  episodeId: string
  pending: boolean
  state: AddPodcastEpisodeToCollectionActionState
}) {
  const [collectionSelection, setCollectionSelection] = useState(
    collections[0]?.id ?? NEW_COLLECTION_VALUE
  )
  const collectionSelectId = `podcast-episode-collection-${episodeId}`
  const collectionNameId = `podcast-episode-collection-name-${episodeId}`
  const isCreatingCollection = collectionSelection === NEW_COLLECTION_VALUE

  return (
    <form action={action} className="grid gap-4">
      <input name="episodeId" type="hidden" value={episodeId} />
      <input
        name="collectionId"
        type="hidden"
        value={isCreatingCollection ? "" : collectionSelection}
      />
      <AlertDialogHeader>
        <AlertDialogTitle>Save to collection</AlertDialogTitle>
        <AlertDialogDescription>
          Keep this podcast episode in a collection for later.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor={collectionSelectId}>
          Collection
        </label>
        <div className="relative">
          <FolderPlus
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <select
            className="h-8 w-full rounded-lg border border-input bg-background pr-2.5 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={pending}
            id={collectionSelectId}
            onChange={(event) =>
              setCollectionSelection(event.currentTarget.value)
            }
            value={collectionSelection}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} ({collection.articleCount})
              </option>
            ))}
            <option value={NEW_COLLECTION_VALUE}>
              Create new collection...
            </option>
          </select>
        </div>
      </div>

      {isCreatingCollection ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor={collectionNameId}>
            New collection name
          </label>
          <input
            autoComplete="off"
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={pending}
            id={collectionNameId}
            maxLength={80}
            name="collectionName"
            placeholder="Listen later"
            required
            type="text"
          />
        </div>
      ) : null}

      <p className="min-h-5 text-sm text-destructive">
        {state.status === "error" ? state.message : ""}
      </p>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit">
          <FolderPlus data-icon="inline-start" />
          {pending ? "Saving" : "Save"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
