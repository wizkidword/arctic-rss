import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()

async function source(path) {
  return await readFile(join(root, path), "utf8")
}

function requireText(text, value, message) {
  if (!text.includes(value)) {
    throw new Error(message)
  }
}

const [authorizeRoute, mutationSubmission, mobileConfig, notificationChannel, mobileSync] = await Promise.all([
  source("src/app/api/mobile/authorize/route.ts"),
  source("apps/mobile/src/sync/submit-mobile-mutation.ts"),
  source("apps/mobile/src/config.ts"),
  source("apps/mobile/src/lib/mobile-notification-channel.ts"),
  source("src/lib/mobile-sync.ts"),
])

requireText(authorizeRoute, 'if (!isNativeMobileAuthorizationEnabled())', "Mobile authorization must fail closed behind its feature gate.")
requireText(mutationSubmission, "type IdempotentRequest", "Replayable mobile writes must require an idempotency request shape.")
requireText(mutationSubmission, "offline.queueMutation", "Replayable mobile writes must use the bounded offline queue.")
requireText(mobileConfig, 'MOBILE_PRODUCTION_AUTH_REDIRECT_URI = "https://arcticrss.com/mobile/auth/callback"', "Production mobile authorization must use the claimed HTTPS callback.")
requireText(mobileConfig, "MOBILE_AUTH_REDIRECT_URI = __DEV__", "Custom-scheme callbacks must remain development-only.")
if (notificationChannel.includes('return "MOBILE_PUSH"') || notificationChannel.includes('"MOBILE_PUSH",')) {
  throw new Error("MOBILE_PUSH cannot become selectable before registration and delivery exist.")
}
requireText(mobileSync, "mobileDeviceId", "Mobile mutation receipts must retain stable-device ownership.")
requireText(mobileSync, "deviceInstallation", "Mobile installation writes must retain stable-device ownership.")

const protectedRoutes = await readdir(join(root, "apps/mobile/app/(authenticated)"), { recursive: true })
if (!protectedRoutes.some((entry) => entry.toString().includes("article"))) {
  throw new Error("Protected mobile content routes must remain inside the authenticated group.")
}

process.stdout.write("Mobile architecture guardrails passed.\n")
