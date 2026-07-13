"use client"

import { useActionState, useEffect, useRef } from "react"
import { UploadIcon } from "lucide-react"

import {
  importOpmlAction,
  type ImportOpmlActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

const initialState: ImportOpmlActionState = {
  message: "",
  status: "idle",
}

export function OpmlImportForm() {
  const [state, formAction, pending] = useActionState(
    importOpmlAction,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
    }
  }, [state.status])

  return (
    <form action={formAction} className="flex flex-col gap-4" ref={formRef}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="opml-file">OPML file</FieldLabel>
          <input
            accept=".opml,.xml,text/xml,application/xml"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            id="opml-file"
            name="opmlFile"
            required
            type="file"
          />
          <FieldDescription>
            Google Reader, Feedly, Inoreader, and standard OPML exports are
            supported. Imports are limited to 2 MB.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {state.status === "error" && <FieldError>{state.message}</FieldError>}
      {state.status === "success" && (
        <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{state.message}</p>
        </div>
      )}

      <Button className="w-fit" disabled={pending} type="submit">
        <UploadIcon data-icon="inline-start" />
        {pending ? "Queueing import..." : "Import OPML"}
      </Button>
    </form>
  )
}
