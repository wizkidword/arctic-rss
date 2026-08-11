import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const appConfig = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"))
const expo = appConfig.expo

assert.equal(expo?.android?.package, "com.arcticrss.reader", "The Android package must remain registered.")
assert.equal(expo?.android?.allowBackup, false, "Android backups must be disabled for mobile account data.")

const authCallbackIsDeclared = expo?.android?.intentFilters?.some((intentFilter) =>
  intentFilter.action === "VIEW" &&
  intentFilter.autoVerify === true &&
  intentFilter.category?.includes("BROWSABLE") &&
  intentFilter.category?.includes("DEFAULT") &&
  intentFilter.data?.some(
    (entry) =>
      entry.scheme === "https" && entry.host === "arcticrss.com" && entry.pathPrefix === "/mobile/auth/callback"
  )
)

assert.equal(authCallbackIsDeclared, true, "The registered HTTPS mobile authorization callback must remain declared.")

const secureStorePlugin = expo?.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-secure-store"
)

assert.equal(
  secureStorePlugin?.[1]?.configureAndroidBackup,
  true,
  "Expo SecureStore must retain its Android backup configuration."
)

console.log("Mobile native configuration verified.")
