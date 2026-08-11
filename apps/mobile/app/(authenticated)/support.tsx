import { Text } from "react-native"

import { ActionButton, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { MOBILE_SERVICE_ORIGIN } from "@/config"
import { openArcticRssWebPath } from "@/web-links"

export default function SupportScreen() {
  return (
    <Screen title="Support">
      <Section>
        <Text style={mobileStyles.muted}>This internal alpha keeps support and account operations on the authenticated Arctic RSS website. Do not include tokens, passwords, or feed URLs in reports.</Text>
        <ActionButton onPress={() => void openArcticRssWebPath("/")} tone="secondary">Open Arctic RSS on web</ActionButton>
        <Text selectable style={mobileStyles.muted}>{MOBILE_SERVICE_ORIGIN}</Text>
      </Section>
    </Screen>
  )
}
