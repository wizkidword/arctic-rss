import { isEmailVerificationRequired } from "./email-verification-policy"

export class UnsafeProductionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeProductionConfigurationError"
  }
}

export function assertSecureProductionConfiguration(
  environment: NodeJS.ProcessEnv = process.env
) {
  if (environment.NODE_ENV !== "production") {
    return
  }

  if (!isEmailVerificationRequired(environment.REQUIRE_EMAIL_VERIFICATION)) {
    throw new UnsafeProductionConfigurationError(
      "REQUIRE_EMAIL_VERIFICATION must be enabled in production."
    )
  }

  if (environment.ADMIN_EMAILS?.trim()) {
    throw new UnsafeProductionConfigurationError(
      "ADMIN_EMAILS is no longer supported. Remove it before starting production."
    )
  }
}
