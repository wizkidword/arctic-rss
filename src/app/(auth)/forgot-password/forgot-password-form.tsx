"use client"

import { useActionState } from "react"
import Link from "next/link"

import { TurnstileWidget } from "@/components/turnstile-widget"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
} from "./actions"

const initialState: ForgotPasswordActionState = {}

type ForgotPasswordFormProps = {
  turnstileSiteKey: string
}

export function ForgotPasswordForm({
  turnstileSiteKey,
}: ForgotPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your account email and we will send you a reset link.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!state.errors?.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!state.errors?.email}
                required
              />
              <FieldError
                errors={state.errors?.email?.map((message) => ({ message }))}
              />
            </Field>
          </FieldGroup>
          <div className="mt-5">
            <TurnstileWidget
              action="password_reset"
              siteKey={turnstileSiteKey}
            />
          </div>
          {state.message && (
            <p
              className="mt-4 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {state.message}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Sending link..." : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link className="font-medium text-foreground underline" href="/login">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
