"use client"

import { useActionState, useEffect, useRef } from "react"
import { SendIcon } from "lucide-react"

import {
  submitFeatureSuggestionAction,
  type SubmitFeatureSuggestionActionState,
} from "@/app/app/actions"
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const initialState: SubmitFeatureSuggestionActionState = {
  message: "",
  status: "idle",
}

function populateBrowserContext(form: HTMLFormElement) {
  const pageUrl = form.elements.namedItem("pageUrl")
  const userAgent = form.elements.namedItem("userAgent")

  if (pageUrl instanceof HTMLInputElement) {
    pageUrl.value = window.location.href
  }

  if (userAgent instanceof HTMLInputElement) {
    userAgent.value = window.navigator.userAgent
  }
}

export function FeatureSuggestionDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [state, action, pending] = useActionState(
    submitFeatureSuggestionAction,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
    }
  }, [state.status])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <form
          action={action}
          className="grid gap-4"
          onSubmitCapture={(event) => populateBrowserContext(event.currentTarget)}
          ref={formRef}
        >
          <input defaultValue="" name="pageUrl" type="hidden" />
          <input defaultValue="" name="userAgent" type="hidden" />

          <AlertDialogHeader>
            <AlertDialogTitle>Suggest a feature</AlertDialogTitle>
            <AlertDialogDescription>
              Send an idea to the Arctic RSS admin dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="feature-suggestion-title">
                Summary
              </FieldLabel>
              <Input
                id="feature-suggestion-title"
                maxLength={120}
                name="title"
                placeholder="A reader workflow or improvement"
                required
                type="text"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="feature-suggestion-description">
                What would you like Arctic RSS to add?
              </FieldLabel>
              <textarea
                className={cn(
                  "min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                )}
                id="feature-suggestion-description"
                maxLength={4000}
                name="description"
                placeholder="Tell us the workflow, what problem it solves, and what would make it feel useful."
                required
              />
              <FieldDescription>
                The current page and browser details are included automatically.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {state.status === "error" && <FieldError>{state.message}</FieldError>}
          {state.status === "success" && (
            <p className="rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {state.message}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending} type="button">
              Close
            </AlertDialogCancel>
            <Button disabled={pending} type="submit">
              <SendIcon data-icon="inline-start" />
              {pending ? "Sending..." : "Send suggestion"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
