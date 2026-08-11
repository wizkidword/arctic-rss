export const DEFAULT_API_JSON_BODY_MAX_BYTES = 8_192
export const DEFAULT_API_JSON_BODY_TIMEOUT_MS = 5_000

export type BoundedJsonBodyErrorCode =
  | "invalid-body"
  | "request-timeout"
  | "request-too-large"
  | "unsupported-content-encoding"
  | "unsupported-media-type"

export class BoundedJsonBodyError extends Error {
  constructor(readonly code: BoundedJsonBodyErrorCode) {
    super("The JSON request body is invalid.")
    this.name = "BoundedJsonBodyError"
  }
}

export async function readBoundedJsonBody(
  request: Request,
  {
    maximumBytes = DEFAULT_API_JSON_BODY_MAX_BYTES,
    timeoutMs = DEFAULT_API_JSON_BODY_TIMEOUT_MS,
  }: {
    maximumBytes?: number
    timeoutMs?: number
  } = {}
): Promise<unknown> {
  assertJsonContentType(request)
  assertIdentityContentEncoding(request)

  const declaredLength = contentLength(request)
  if (declaredLength !== null && declaredLength > maximumBytes) {
    throw new BoundedJsonBodyError("request-too-large")
  }

  const reader = request.body?.getReader()
  if (!reader) {
    throw new BoundedJsonBodyError("invalid-body")
  }

  const chunks: Uint8Array[] = []
  let length = 0
  const deadline = Date.now() + timeoutMs

  try {
    while (true) {
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        throw new BoundedJsonBodyError("request-timeout")
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
        throw new BoundedJsonBodyError("request-too-large")
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    if (error instanceof BoundedJsonBodyError) {
      throw error
    }
    throw new BoundedJsonBodyError("invalid-body")
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new BoundedJsonBodyError("invalid-body")
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new BoundedJsonBodyError("invalid-body")
  }
}

function assertJsonContentType(request: Request) {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (mediaType !== "application/json") {
    throw new BoundedJsonBodyError("unsupported-media-type")
  }
}

function assertIdentityContentEncoding(request: Request) {
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase()
  if (contentEncoding && contentEncoding !== "identity") {
    throw new BoundedJsonBodyError("unsupported-content-encoding")
  }
}

function contentLength(request: Request) {
  const value = request.headers.get("content-length")?.trim()
  if (!value) {
    return null
  }
  if (!/^\d+$/.test(value)) {
    throw new BoundedJsonBodyError("invalid-body")
  }

  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    throw new BoundedJsonBodyError("invalid-body")
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
        timeout = setTimeout(() => reject(new BoundedJsonBodyError("request-timeout")), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
