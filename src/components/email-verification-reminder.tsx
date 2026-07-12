"use client"

import { useActionState } from "react"
import { MailCheckIcon, SendIcon } from "lucide-react"

import {
  resendEmailVerificationAction,
  type ResendEmailVerificationActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: ResendEmailVerificationActionState = {
  message: "",
  status: "idle",
}

export function EmailVerificationReminder({
  className,
}: {
  className?: string
}) {
  const [state, formAction, pending] = useActionState(
    resendEmailVerificationAction,
    initialState
  )

  return (
    <section
      aria-label="Email verification reminder"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 gap-3">
        <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium">Verify your email</p>
          <p className="mt-1 text-muted-foreground">
            You can keep reading now. Verify when the email arrives so your
            account stays easy to recover later.
          </p>
          {state.message ? (
            <p
              className={cn(
                "mt-2 text-xs",
                state.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
      <form action={formAction}>
        <Button disabled={pending} size="sm" type="submit" variant="outline">
          <SendIcon data-icon="inline-start" />
          {pending ? "Sending..." : "Resend verification email"}
        </Button>
      </form>
    </section>
  )
}
