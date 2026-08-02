"use client"

import { useActionState } from "react"
import { UserXIcon } from "lucide-react"

import {
  disableUserAction,
  type DisableUserActionState,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: DisableUserActionState = {
  message: "",
  status: "idle",
}

export function AdminDisableUserButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(disableUserAction, initialState)

  return (
    <form action={action} className="grid gap-1">
      <input name="targetUserId" type="hidden" value={userId} />
      <Button
        aria-describedby={`disable-user-status-${userId}`}
        disabled={pending}
        size="xs"
        type="submit"
        variant="destructive"
      >
        <UserXIcon data-icon="inline-start" />
        {pending ? "Disabling" : "Disable user"}
      </Button>
      <span
        aria-live="polite"
        className={cn(
          "max-w-40 text-xs",
          state.status === "error" && "text-destructive",
          state.status === "success" && "text-muted-foreground"
        )}
        id={`disable-user-status-${userId}`}
      >
        {state.message}
      </span>
    </form>
  )
}
