const DISABLED_VALUES = new Set(["0", "false", "no", "off"])

export function isEmailVerificationRequired(
  value = process.env.REQUIRE_EMAIL_VERIFICATION
) {
  if (!value?.trim()) {
    return true
  }

  return !DISABLED_VALUES.has(value.trim().toLowerCase())
}

export function shouldBlockLoginForUnverifiedEmail(
  emailVerified: Date | null | undefined
) {
  return isEmailVerificationRequired() && !emailVerified
}

export function shouldFailSignupWhenVerificationEmailFails() {
  return isEmailVerificationRequired()
}

export function getSignupSuccessRedirectPath() {
  return isEmailVerificationRequired()
    ? "/login?verify=1"
    : "/login?registered=1"
}
