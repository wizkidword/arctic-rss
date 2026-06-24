"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { PlusIcon, RssIcon } from "lucide-react"

import {
  addFeedAction,
  type AddFeedActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const initialState: AddFeedActionState = {
  message: "",
  status: "idle",
}

type AddFeedFolder = {
  id: string
  name: string
}

export function AddFeedSheet({
  className,
  folders = [],
}: {
  className?: string
  folders?: AddFeedFolder[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    addFeedAction,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
    }
  }, [state.status])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            className={cn("w-full justify-start", className)}
            size="sm"
            variant="outline"
          />
        }
      >
        <PlusIcon data-icon="inline-start" />
        Add Feed
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Feed</SheetTitle>
          <SheetDescription>
            Subscribe with an RSS/Atom URL or paste a website URL and Arctic RSS will look for a feed.
          </SheetDescription>
        </SheetHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4 px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="feed-url">Feed or website URL</FieldLabel>
              <Input
                autoComplete="url"
                id="feed-url"
                inputMode="url"
                name="url"
                placeholder="https://example.com/feed"
                required
                type="text"
              />
              <FieldDescription>
                HTTP and HTTPS only. Local and private network addresses are blocked.
              </FieldDescription>
            </Field>
            {folders.length > 0 && (
              <Field>
                <FieldLabel htmlFor="feed-folder">Folder</FieldLabel>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  id="feed-folder"
                  name="folderId"
                >
                  <option value="">Uncategorized</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </FieldGroup>

          {state.status === "error" && <FieldError>{state.message}</FieldError>}
          {state.status === "success" && (
            <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {state.message}
            </p>
          )}

          <Button disabled={pending} type="submit">
            <RssIcon data-icon="inline-start" />
            {pending ? "Checking..." : "Subscribe"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
