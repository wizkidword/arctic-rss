const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response"

type TurnstileSiteverifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
  "error-codes"?: string[]
}

export type TurnstileVerificationOptions = {
  expectedAction?: string
  remoteIp?: string
}

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

export function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}

export function getTurnstileSiteKey() {
  return (
    process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]?.trim() ??
    process.env["TURNSTILE_SITE_KEY"]?.trim() ??
    ""
  )
}

export function getTurnstileTokenFromFormData(formData: FormData) {
  const token = formData.get(TURNSTILE_TOKEN_FIELD)

  return typeof token === "string" ? token : ""
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: TurnstileVerificationOptions = {}
): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
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
    })

    if (!response.ok) {
      return {
        success: false,
        errorCodes: ["siteverify-http-error"],
      }
    }

    payload = (await response.json()) as TurnstileSiteverifyResponse
  } catch {
    return {
      success: false,
      errorCodes: ["siteverify-request-failed"],
    }
  }

  if (!payload.success) {
    return {
      success: false,
      errorCodes: payload["error-codes"] ?? ["siteverify-failed"],
    }
  }

  if (
    options.expectedAction &&
    payload.action &&
    payload.action !== options.expectedAction
  ) {
    return {
      success: false,
      errorCodes: ["action-mismatch"],
    }
  }

  return {
    success: true,
    action: payload.action,
    hostname: payload.hostname,
  }
}
