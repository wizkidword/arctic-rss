export const MOBILE_STORE_SCHEMA_VERSION = 2

export type MobileStoreUpgrade = "initialize" | "upgrade-v1" | "none"

export function requiresMobileStoreInitialization(currentVersion: number) {
  return mobileStoreUpgrade(currentVersion) !== "none"
}

export function mobileStoreUpgrade(currentVersion: number): MobileStoreUpgrade {
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || currentVersion > MOBILE_STORE_SCHEMA_VERSION) {
    throw new Error("Mobile offline storage has an unsupported schema version.")
  }
  if (currentVersion === 0) {
    return "initialize"
  }
  if (currentVersion === 1) {
    return "upgrade-v1"
  }
  return "none"
}
