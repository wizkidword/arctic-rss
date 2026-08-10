export const MIN_ACCEPTED_PUBLICATION_DATE = new Date("1970-01-01T00:00:00.000Z")
export const MAX_DATABASE_SAFE_PUBLICATION_DATE = new Date("9999-12-31T23:59:59.999Z")
export const MAX_PUBLICATION_FUTURE_SKEW_MS = 72 * 60 * 60 * 1_000

export type PublisherPublicationDateDiagnostic =
  | "future-skew"
  | "invalid"
  | "out-of-range"

export type PublisherPublicationDateDiagnostics = Record<
  PublisherPublicationDateDiagnostic,
  number
>

export function createPublisherPublicationDateDiagnostics(): PublisherPublicationDateDiagnostics {
  return {
    "future-skew": 0,
    invalid: 0,
    "out-of-range": 0,
  }
}

export function parsePublisherPublicationDate(
  value: string | undefined,
  { now = new Date() }: { now?: Date } = {}
) {
  if (!value) {
    return {}
  }

  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return { diagnostic: "invalid" as const }
  }

  if (date < MIN_ACCEPTED_PUBLICATION_DATE || date > MAX_DATABASE_SAFE_PUBLICATION_DATE) {
    return { diagnostic: "out-of-range" as const }
  }

  if (date.valueOf() > now.valueOf() + MAX_PUBLICATION_FUTURE_SKEW_MS) {
    return { diagnostic: "future-skew" as const }
  }

  return { date }
}
