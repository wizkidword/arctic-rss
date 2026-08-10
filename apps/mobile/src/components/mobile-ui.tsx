import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export function Screen({
  children,
  isRefreshing,
  onRefresh,
  title,
}: {
  children: ReactNode
  isRefreshing?: boolean
  onRefresh?: () => void
  title: string
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(isRefreshing)} onRefresh={onRefresh} /> : undefined
        }
      >
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function Section({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  )
}

export function ActionButton({
  accessibilityLabel,
  children,
  disabled,
  onPress,
  tone = "primary",
}: {
  accessibilityLabel?: string
  children: ReactNode
  disabled?: boolean
  onPress: () => void
  tone?: "danger" | "primary" | "secondary"
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "danger" ? styles.dangerButton : tone === "secondary" ? styles.secondaryButton : styles.primaryButton,
        (disabled || pressed) && styles.pressedButton,
      ]}
    >
      <Text style={tone === "secondary" ? styles.secondaryButtonText : styles.buttonText}>{children}</Text>
    </Pressable>
  )
}

export function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return <Text style={tone === "error" ? styles.error : styles.info}>{children}</Text>
}

export function Loading() {
  return <ActivityIndicator accessibilityLabel="Loading" style={styles.loading} />
}

export const mobileStyles = StyleSheet.create({
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  body: { color: "#263945", fontSize: 16, lineHeight: 25 },
  input: { borderColor: "#aebdc6", borderRadius: 8, borderWidth: 1, color: "#10212b", minHeight: 44, paddingHorizontal: 12 },
  listItem: { borderBottomColor: "#dbe5eb", borderBottomWidth: 1, gap: 4, paddingVertical: 14 },
  listTitle: { color: "#12202b", fontSize: 16, fontWeight: "600" },
  muted: { color: "#52616b", fontSize: 14, lineHeight: 20 },
})

const styles = StyleSheet.create({
  button: { borderRadius: 8, minHeight: 44, paddingHorizontal: 14, paddingVertical: 11 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700", textAlign: "center" },
  content: { gap: 16, padding: 16, paddingBottom: 36 },
  dangerButton: { backgroundColor: "#b42318" },
  error: { color: "#9b1c1c", fontSize: 14, lineHeight: 20 },
  info: { color: "#1f5a7a", fontSize: 14, lineHeight: 20 },
  loading: { marginVertical: 24 },
  pressedButton: { opacity: 0.65 },
  primaryButton: { backgroundColor: "#0a6e85" },
  safeArea: { backgroundColor: "#f7fafc", flex: 1 },
  secondaryButton: { backgroundColor: "#e5edf1" },
  secondaryButtonText: { color: "#17313e", fontSize: 15, fontWeight: "700", textAlign: "center" },
  section: { backgroundColor: "#ffffff", borderColor: "#dbe5eb", borderRadius: 12, borderWidth: 1, gap: 10, padding: 14 },
  sectionTitle: { color: "#17313e", fontSize: 17, fontWeight: "700" },
  title: { color: "#10212b", fontSize: 28, fontWeight: "800" },
})
