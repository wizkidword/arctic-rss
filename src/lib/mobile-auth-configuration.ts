export type MobileAuthorizationEnvironment = Readonly<Record<string, string | undefined>>

// New native authorization must be an explicit operator decision. This is
// deliberately false for missing, malformed, and development environments.
export function isNativeMobileAuthorizationEnabled(
  environment: MobileAuthorizationEnvironment = process.env
) {
  return environment.MOBILE_NATIVE_AUTHORIZATION_ENABLED === "true"
}
