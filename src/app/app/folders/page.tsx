import Link from "next/link"
import { redirect } from "next/navigation"
import {
  FolderIcon,
  MoveRightIcon,
  PencilIcon,
  PlusIcon,
  RssIcon,
  Trash2Icon,
} from "lucide-react"

import {
  createFolderAction,
  deleteFolderAction,
  moveSubscriptionToFolderAction,
  renameFolderAction,
} from "@/app/app/actions"
import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"

export default async function FoldersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [folders, subscriptions] = await Promise.all([
    listUserFolders(session.user.id),
    listUserFeedSubscriptions(session.user.id),
  ])

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">Folders</h1>
            <Badge variant="secondary">
              {folders.length} {folders.length === 1 ? "folder" : "folders"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Organize subscriptions into reader folders and open each folder as
            its own article stream.
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <FolderIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">Create Folder</h2>
        </div>
        <form
          action={createFolderAction}
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <Input
            aria-label="Folder name"
            maxLength={80}
            name="name"
            placeholder="Folder name"
            required
          />
          <Button type="submit">
            <PlusIcon data-icon="inline-start" />
            Create
          </Button>
        </form>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-heading text-base font-medium">Your Folders</h2>
            <p className="text-sm text-muted-foreground">
              Rename folders or remove them without deleting feeds.
            </p>
          </div>
        </div>

        {folders.length ? (
          <div className="divide-y">
            {folders.map((folder) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(260px,380px)_auto]"
                key={folder.id}
              >
                <div className="min-w-0">
                  <Link
                    className="inline-flex max-w-full items-center gap-2 font-medium underline-offset-4 hover:underline"
                    href={`/app/folder/${folder.id}`}
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{folder.name}</span>
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {folder.subscriptionCount}{" "}
                    {folder.subscriptionCount === 1 ? "feed" : "feeds"} ·{" "}
                    {folder.unreadCount} unread
                  </p>
                </div>

                <form
                  action={renameFolderAction}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <input name="folderId" type="hidden" value={folder.id} />
                  <Input
                    aria-label={`Rename ${folder.name}`}
                    defaultValue={folder.name}
                    maxLength={80}
                    name="name"
                    required
                  />
                  <Button type="submit" variant="outline">
                    <PencilIcon data-icon="inline-start" />
                    Rename
                  </Button>
                </form>

                <form action={deleteFolderAction}>
                  <input name="folderId" type="hidden" value={folder.id} />
                  <Button type="submit" variant="destructive">
                    <Trash2Icon data-icon="inline-start" />
                    Delete
                  </Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No folders yet. Create one to start grouping subscriptions.
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-heading text-base font-medium">
              Feed Organization
            </h2>
            <p className="text-sm text-muted-foreground">
              Move each subscription into a folder or leave it uncategorized.
            </p>
          </div>
          <Badge variant="secondary">
            {subscriptions.length}{" "}
            {subscriptions.length === 1 ? "subscription" : "subscriptions"}
          </Badge>
        </div>

        {subscriptions.length ? (
          <div className="divide-y">
            {subscriptions.map((subscription) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,420px)]"
                key={subscription.id}
              >
                <div className="min-w-0">
                  <Link
                    className="inline-flex max-w-full items-center gap-2 font-medium underline-offset-4 hover:underline"
                    href={`/app/feed/${subscription.id}`}
                  >
                    <RssIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{subscription.title}</span>
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscription.folderName || "Uncategorized"} ·{" "}
                    {subscription.unreadCount} unread
                  </p>
                </div>

                <form
                  action={moveSubscriptionToFolderAction}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <input
                    name="subscriptionId"
                    type="hidden"
                    value={subscription.id}
                  />
                  <select
                    aria-label={`Folder for ${subscription.title}`}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    defaultValue={subscription.folderId ?? ""}
                    key={`${subscription.id}-${subscription.folderId ?? "uncategorized"}`}
                    name="folderId"
                  >
                    <option value="">Uncategorized</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">
                    <MoveRightIcon data-icon="inline-start" />
                    Move
                  </Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Add feeds before organizing subscriptions.
          </p>
        )}
      </section>
    </div>
  )
}
