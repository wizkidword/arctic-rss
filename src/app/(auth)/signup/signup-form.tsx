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

import { signupAction, type SignupActionState } from "./actions"

const initialState: SignupActionState = {}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start with the reader foundation. Feeds arrive in the next milestone.
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
