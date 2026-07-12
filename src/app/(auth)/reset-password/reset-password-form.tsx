"use client"

import { useActionState } from "react"
import Link from "next/link"

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

import { resetPasswordAction, type ResetPasswordActionState } from "./actions"

const initialState: ResetPasswordActionState = {}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState
  )
  const missingToken = token.trim().length === 0

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Reset links expire after 1 hour and can only be used once.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <CardContent>
          <FieldGroup>
            <Field data-invalid={missingToken || !!state.errors?.token}>
              {missingToken ? (
                <FieldError>
                  This reset link is missing a token. Request a new link and try
                  again.
                </FieldError>
              ) : (
                <FieldError
                  errors={state.errors?.token?.map((message) => ({ message }))}
                />
              )}
            </Field>
            <Field data-invalid={!!state.errors?.password}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!state.errors?.password}
                minLength={8}
                required
              />
              <FieldError
                errors={state.errors?.password?.map((message) => ({ message }))}
              />
            </Field>
            <Field data-invalid={!!state.errors?.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!state.errors?.confirmPassword}
                minLength={8}
                required
              />
              <FieldError
                errors={state.errors?.confirmPassword?.map((message) => ({
                  message,
                }))}
              />
            </Field>
          </FieldGroup>
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
          <Button type="submit" disabled={pending || missingToken}>
            {pending ? "Saving password..." : "Save new password"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Need a new link?{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/forgot-password"
            >
              Start over
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
