import { isEmailVerificationRequired } from "./email-verification-policy"
import {
  AppOriginConfigurationError,
  assertProductionAppOrigin,
  getAllowedAppHosts,
  getAppOrigin,
} from "./app-origin"

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

  let appOrigin: URL

  try {
    appOrigin = assertProductionAppOrigin(environment)
    getAllowedAppHosts(environment)
  } catch (error) {
    if (error instanceof AppOriginConfigurationError) {
      throw new UnsafeProductionConfigurationError(error.message)
    }

    throw error
  }

  if (!environment.AUTH_URL?.trim()) {
    throw new UnsafeProductionConfigurationError(
      "AUTH_URL must be configured in production."
    )
  }

  for (const variable of ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
    const value = environment[variable]?.trim()

    if (!value) {
      continue
    }

    let configuredOrigin: URL

    try {
      configuredOrigin = getAppOrigin({ APP_ORIGIN: value })
    } catch {
      throw new UnsafeProductionConfigurationError(
        `${variable} must be a valid application origin when configured.`
      )
    }

    if (configuredOrigin.origin !== appOrigin.origin) {
      throw new UnsafeProductionConfigurationError(
        `${variable} must match APP_ORIGIN in production.`
      )
    }
  }
}
