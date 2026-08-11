import { Text } from "react-native"

import { Screen, Section, mobileStyles } from "@/components/mobile-ui"

// Browser authentication normally closes this route immediately. It contains
// no token handling so an App Link opened outside that flow never exposes code
// or state values in the Android UI.
export default function MobileAuthCallbackScreen() {
  return (
    <Screen title="Sign in">
      <Section>
        <Text style={mobileStyles.muted}>Return to Arctic RSS to finish signing in.</Text>
      </Section>
    </Screen>
  )
}
