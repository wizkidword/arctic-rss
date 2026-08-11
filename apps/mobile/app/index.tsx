import { Redirect, type Href, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Text } from "react-native"

import { ActionButton, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { safeMobileReturnPath } from "@/auth/safe-mobile-return-path"

export default function WelcomeScreen() {
  const { isSignedIn, signIn } = useMobileApp()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const [error, setError] = useState<string | null>(null)
  if (isSignedIn) {
    return <Redirect href={(safeMobileReturnPath(returnTo) ?? "/(authenticated)/(tabs)") as Href} />
  }

  return (
    <Screen title="Arctic RSS">
      <Section title="A calm native reader">
        <Text style={mobileStyles.muted}>
          Read your feeds, save important articles, follow podcasts, and review briefings with the same Arctic RSS account.
        </Text>
        <ActionButton
          accessibilityLabel="Sign in with Arctic RSS"
          onPress={() => {
            setError(null)
            void signIn().catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Arctic RSS could not complete sign-in.")
            })
          }}
        >
          Continue in browser
        </ActionButton>
        {error ? <Notice>{error}</Notice> : null}
        <Notice tone="info">
          Sign-in opens your browser. Arctic RSS never asks this app to collect your password.
        </Notice>
      </Section>
    </Screen>
  )
}
