"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"

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
import { trackAnalyticsEvent } from "@/lib/google-analytics-events"

import { signupAction, type SignupActionState } from "./actions"

const initialState: SignupActionState = {}

type SignupFormProps = {
  googleAuthEnabled: boolean
  turnstileSiteKey: string
}

export function SignupForm({
  googleAuthEnabled,
  turnstileSiteKey,
}: SignupFormProps) {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState
  )
  const [googlePending, setGooglePending] = useState(false)

  function onGoogleSignUp() {
    trackAnalyticsEvent("sign_up_start", { method: "google" })
    setGooglePending(true)
    void signIn("google", { redirectTo: "/app" })
  }

  function onEmailSignUp() {
    trackAnalyticsEvent("sign_up_start", { method: "email" })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Build your reader, discover feeds, and keep your subscriptions in sync.
        </CardDescription>
      </CardHeader>
      {googleAuthEnabled && (
        <CardContent className="pb-0">
          <Button
            className="w-full"
            disabled={pending || googlePending}
            onClick={onGoogleSignUp}
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="grid size-4 place-items-center rounded-full border text-[0.65rem] font-semibold"
            >
              G
            </span>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </CardContent>
      )}
      <form action={formAction} onSubmit={onEmailSignUp}>
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
              <FieldError errors={state.errors?.email?.map((message) => ({ message }))} />
            </Field>
            <Field data-invalid={!!state.errors?.name}>
              <FieldLabel htmlFor="name">Display name</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                aria-invalid={!!state.errors?.name}
              />
              <FieldError errors={state.errors?.name?.map((message) => ({ message }))} />
            </Field>
            <Field data-invalid={!!state.errors?.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!state.errors?.password}
                minLength={8}
                required
              />
              <FieldError errors={state.errors?.password?.map((message) => ({ message }))} />
            </Field>
          </FieldGroup>
          <div className="mt-5">
            <TurnstileWidget action="signup" siteKey={turnstileSiteKey} />
          </div>
          {state.message && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              {state.message}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating account..." : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-foreground underline" href="/login">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
