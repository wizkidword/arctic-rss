export const DEFAULT_URLENCODED_FORM_MAX_BYTES = 8_192
export const DEFAULT_URLENCODED_FORM_TIMEOUT_MS = 5_000

export type BoundedUrlEncodedFormErrorCode =
  | "invalid-body"
  | "request-timeout"
  | "request-too-large"
  | "unsupported-content-encoding"
  | "unsupported-media-type"

export class BoundedUrlEncodedFormError extends Error {
  constructor(readonly code: BoundedUrlEncodedFormErrorCode) {
    super("The form request body is invalid.")
    this.name = "BoundedUrlEncodedFormError"
  }
}

// This intentionally mirrors the bounded JSON reader used by the token
// endpoints. Browser approval is a credential-bearing form, so never hand it
// to Request.formData(), which accepts multipart bodies without a size limit.
export async function readBoundedUrlEncodedForm(
  request: Request,
  {
    allowedFields,
    maximumBytes = DEFAULT_URLENCODED_FORM_MAX_BYTES,
    timeoutMs = DEFAULT_URLENCODED_FORM_TIMEOUT_MS,
  }: {
    allowedFields: readonly string[]
    maximumBytes?: number
    timeoutMs?: number
  }
): Promise<Record<string, string>> {
  assertUrlEncodedContentType(request)
  assertIdentityContentEncoding(request)

  const declaredLength = contentLength(request)
  if (declaredLength !== null && declaredLength > maximumBytes) {
    throw new BoundedUrlEncodedFormError("request-too-large")
  }

  const reader = request.body?.getReader()
  if (!reader) {
    throw new BoundedUrlEncodedFormError("invalid-body")
  }

  const chunks: Uint8Array[] = []
  let length = 0
  const deadline = Date.now() + timeoutMs

  try {
    while (true) {
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        throw new BoundedUrlEncodedFormError("request-timeout")
      }

      const { done, value } = await readWithDeadline(reader, remainingMs)
      if (done) {
        break
      }
      if (!value) {
        continue
      }

      length += value.byteLength
      if (length > maximumBytes) {
        throw new BoundedUrlEncodedFormError("request-too-large")
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    if (error instanceof BoundedUrlEncodedFormError) {
      throw error
    }
    throw new BoundedUrlEncodedFormError("invalid-body")
  } finally {
    reader.releaseLock()
  }

  let text: string
  try {
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new BoundedUrlEncodedFormError("invalid-body")
  }

  const allowed = new Set(allowedFields)
  const parsed = new URLSearchParams(text)
  const result: Record<string, string> = {}
  for (const [key, value] of parsed) {
    if (!allowed.has(key) || key in result) {
      throw new BoundedUrlEncodedFormError("invalid-body")
    }
    result[key] = value
  }
  return result
}

function assertUrlEncodedContentType(request: Request) {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (mediaType !== "application/x-www-form-urlencoded") {
    throw new BoundedUrlEncodedFormError("unsupported-media-type")
  }
}

function assertIdentityContentEncoding(request: Request) {
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase()
  if (contentEncoding && contentEncoding !== "identity") {
    throw new BoundedUrlEncodedFormError("unsupported-content-encoding")
  }
}

function contentLength(request: Request) {
  const value = request.headers.get("content-length")?.trim()
  if (!value) {
    return null
  }
  if (!/^\d+$/.test(value)) {
    throw new BoundedUrlEncodedFormError("invalid-body")
  }

  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    throw new BoundedUrlEncodedFormError("invalid-body")
  }
  return length
}

async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new BoundedUrlEncodedFormError("request-timeout")), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
