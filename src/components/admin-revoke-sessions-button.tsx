"use client"

import { useActionState } from "react"
import { LogOutIcon } from "lucide-react"

import {
  revokeUserSessionsAction,
  type RevokeUserSessionsActionState,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: RevokeUserSessionsActionState = {
  message: "",
  status: "idle",
}

export function AdminRevokeSessionsButton({
  userId,
}: {
  userId: string
}) {
  const [state, action, pending] = useActionState(
    revokeUserSessionsAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-1">
      <input name="targetUserId" type="hidden" value={userId} />
      <Button
        aria-describedby={`revoke-sessions-status-${userId}`}
        disabled={pending}
        size="xs"
        type="submit"
        variant="destructive"
      >
        <LogOutIcon data-icon="inline-start" />
        {pending ? "Revoking" : "Revoke sessions"}
      </Button>
      <span
        aria-live="polite"
        className={cn(
          "max-w-40 text-xs",
          state.status === "error" && "text-destructive",
          state.status === "success" && "text-muted-foreground"
        )}
        id={`revoke-sessions-status-${userId}`}
      >
        {state.message}
      </span>
    </form>
  )
}
