type TimeCursor = {
  createdAt: Date
  id: string
  publishedAt: Date | null
}

type TimeCursorRecord = {
  createdAt: Date
  id: string
  publishedAt: Date | null
}

/**
 * Opaque cursor for records ordered by publishedAt DESC NULLS LAST, then
 * createdAt DESC, then id DESC. All order fields are retained, so new records
 * cannot shift a reader between pages.
 */
export function encodeTimeCursor(record: TimeCursorRecord) {
  return Buffer.from(
    JSON.stringify({
      c: record.createdAt.toISOString(),
      i: record.id,
      p: record.publishedAt?.toISOString() ?? null,
      v: 1,
    })
  ).toString("base64url")
}

export function decodeTimeCursor(value: string | undefined): TimeCursor | null {
  if (!value || value.length > 512) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.v !== 1 ||
      typeof parsed.c !== "string" ||
      typeof parsed.i !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(parsed.i) ||
      (parsed.p !== null && typeof parsed.p !== "string")
    ) {
      return null
    }

    const createdAt = new Date(parsed.c)
    const publishedAt = parsed.p === null ? null : new Date(parsed.p)

    if (
      Number.isNaN(createdAt.getTime()) ||
      (publishedAt && Number.isNaN(publishedAt.getTime()))
    ) {
      return null
    }

    return { createdAt, id: parsed.i, publishedAt }
  } catch {
    return null
  }
}

export function afterTimeCursorWhere(
  cursor: TimeCursor,
  publishedAtField: string
) {
  const samePublishedAt = {
    AND: [
      { [publishedAtField]: cursor.publishedAt },
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          {
            AND: [
              { createdAt: cursor.createdAt },
              { id: { lt: cursor.id } },
            ],
          },
        ],
      },
    ],
  }

  if (cursor.publishedAt === null) {
    return samePublishedAt
  }

  return {
    OR: [
      { [publishedAtField]: { lt: cursor.publishedAt } },
      { [publishedAtField]: null },
      samePublishedAt,
    ],
  }
}

export function pageSize(value: number, maximum = 100) {
  return Math.max(1, Math.min(maximum, Math.floor(value)))
}
