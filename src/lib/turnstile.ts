import { getAppOrigin } from "./app-origin"

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response"
const TURNSTILE_TIMEOUT_MS = 5_000

type TurnstileSiteverifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
  "error-codes"?: string[]
}

export type TurnstileVerificationOptions = {
  expectedAction?: string
  expectedHostname?: string
  remoteIp?: string
}

type TurnstileEnvironment = Record<string, string | undefined>

export type TurnstileVerificationResult =
  | {
      success: true
      skipped?: boolean
      action?: string
      hostname?: string
    }
  | {
      success: false
      errorCodes: string[]
    }

function envValue(
  environment: TurnstileEnvironment,
  name: string
) {
  return environment[name]?.trim() ?? ""
}

function normalizeHostname(value: string | undefined) {
  const hostname = value?.trim().toLowerCase()

  if (!hostname || hostname.includes(":")) {
    return ""
  }

  return hostname
}

function reportedErrorCodes(payload: TurnstileSiteverifyResponse) {
  const rawCodes = payload["error-codes"]
  return Array.isArray(rawCodes)
    ? rawCodes.filter(
        (code): code is string => typeof code === "string" && code.length > 0
      )
    : []
}

function responseErrorCodes(payload: TurnstileSiteverifyResponse) {
  const codes = reportedErrorCodes(payload)

  return codes?.length ? codes : ["siteverify-failed"]
}

export function isTurnstileConfigured(
  environment: TurnstileEnvironment = process.env
) {
  return Boolean(envValue(environment, "TURNSTILE_SECRET_KEY"))
}

export function isTurnstileRequired(
  environment: TurnstileEnvironment = process.env
) {
  return ["1", "true", "yes"].includes(
    envValue(environment, "TURNSTILE_REQUIRED").toLowerCase()
  )
}

export function getTurnstileSiteKey(
  environment: TurnstileEnvironment = process.env
) {
  return (
    envValue(environment, "NEXT_PUBLIC_TURNSTILE_SITE_KEY") ||
    envValue(environment, "TURNSTILE_SITE_KEY") ||
    ""
  )
}

export function getTurnstileExpectedHostname(
  environment: TurnstileEnvironment = process.env
) {
  return getAppOrigin(environment).hostname.toLowerCase()
}

export function assertTurnstileConfiguration(
  environment: TurnstileEnvironment = process.env
) {
  if (!isTurnstileRequired(environment)) {
    return
  }

  if (!isTurnstileConfigured(environment) || !getTurnstileSiteKey(environment)) {
    throw new Error(
      "TURNSTILE_REQUIRED requires TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY."
    )
  }

  if (!getTurnstileExpectedHostname(environment)) {
    throw new Error("TURNSTILE_REQUIRED requires a valid APP_ORIGIN hostname.")
  }
}

export function getTurnstileTokenFromFormData(formData: FormData) {
  const token = formData.get(TURNSTILE_TOKEN_FIELD)

  return typeof token === "string" ? token : ""
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: TurnstileVerificationOptions = {}
): Promise<TurnstileVerificationResult> {
  const secret = envValue(process.env, "TURNSTILE_SECRET_KEY")

  if (!secret) {
    if (isTurnstileRequired()) {
      return {
        success: false,
        errorCodes: ["turnstile-not-configured"],
      }
    }

    return { success: true, skipped: true }
  }

  const responseToken = token?.trim()

  if (!responseToken) {
    return {
      success: false,
      errorCodes: ["missing-input-response"],
    }
  }

  const body = new URLSearchParams({
    secret,
    response: responseToken,
  })

  if (options.remoteIp) {
    body.set("remoteip", options.remoteIp)
  }

  let payload: TurnstileSiteverifyResponse

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    })

    if (!response.ok) {
      return {
        success: false,
        errorCodes: ["siteverify-http-error"],
      }
    }

    const responseBody: unknown = await response.json()

    if (
      !responseBody ||
      typeof responseBody !== "object" ||
      Array.isArray(responseBody)
    ) {
      return {
        success: false,
        errorCodes: ["siteverify-invalid-response"],
      }
    }

    payload = responseBody as TurnstileSiteverifyResponse
  } catch {
    return {
      success: false,
      errorCodes: ["siteverify-request-failed"],
    }
  }

  if (!payload.success) {
    return {
      success: false,
      errorCodes: responseErrorCodes(payload),
    }
  }

  const expectedAction = options.expectedAction?.trim()

  if (!expectedAction) {
    return {
      success: false,
      errorCodes: ["missing-expected-action"],
    }
  }

  if (payload.action !== expectedAction) {
    return {
      success: false,
      errorCodes: ["action-mismatch"],
    }
  }

  const expectedHostname = normalizeHostname(options.expectedHostname)

  if (!expectedHostname) {
    return {
      success: false,
      errorCodes: ["missing-expected-hostname"],
    }
  }

  if (normalizeHostname(payload.hostname) !== expectedHostname) {
    return {
      success: false,
      errorCodes: ["hostname-mismatch"],
    }
  }

  if (reportedErrorCodes(payload).length > 0) {
    return {
      success: false,
      errorCodes: ["siteverify-error-codes"],
    }
  }

  return {
    success: true,
    action: payload.action,
    hostname: payload.hostname,
  }
}
