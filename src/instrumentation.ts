import { assertSecureProductionConfiguration } from "@/lib/production-security"

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertSecureProductionConfiguration()
  }
}
