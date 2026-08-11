export const MOBILE_STORE_SCHEMA_VERSION = 1

export function requiresMobileStoreInitialization(currentVersion: number) {
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || currentVersion > MOBILE_STORE_SCHEMA_VERSION) {
    throw new Error("Mobile offline storage has an unsupported schema version.")
  }
  return currentVersion < MOBILE_STORE_SCHEMA_VERSION
}
