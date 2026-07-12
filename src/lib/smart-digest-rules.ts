export type SmartDigestParsedTerm = {
  kind: "keyword" | "phrase"
  value: string
}

export type SmartDigestMatchArticle = {
  contentText: string | null
  feedTitle: string | null
  summary: string | null
  title: string | null
}

export type SmartDigestMatchResult =
  | {
      matched: true
      matchedFields: string[]
      matchedTerms: string[]
      reason: string
    }
  | {
      matched: false
      matchedFields: string[]
      matchedTerms: string[]
      reason: string
    }

export function parseSmartDigestTerms(
  value: string | string[]
): SmartDigestParsedTerm[] {
  if (Array.isArray(value)) {
    return dedupeTerms(value.flatMap(parseArrayTerm))
  }

  const source = value
  const terms: SmartDigestParsedTerm[] = []
  const pattern = /-*"([^"]*)"|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    const isPhrase = match[1] !== undefined
    const raw = normalizeTerm(isPhrase ? match[1] : match[2] || "")

    if (!raw) {
      continue
    }

    terms.push({
      kind: isPhrase ? "phrase" : "keyword",
      value: raw,
    })
  }

  return dedupeTerms(terms)
}

export function matchSmartDigestArticle({
  article,
  excludeTerms,
  includeTerms,
}: {
  article: SmartDigestMatchArticle
  excludeTerms: string[]
  includeTerms: string[]
}): SmartDigestMatchResult {
  const fields = articleFields(article)
  const excludes = parseSmartDigestTerms(excludeTerms)

  for (const term of excludes) {
    const matchingFields = fields.filter((candidate) =>
      fieldMatches(candidate.value, term)
    )

    if (matchingFields.length) {
      const matchedFieldNames = matchingFields.map((field) => field.name)

      return {
        matched: false,
        matchedFields: matchedFieldNames,
        matchedTerms: [term.value],
        reason: `Excluded by "${term.value}" in ${joinReasonParts(
          matchedFieldNames
        )}.`,
      }
    }
  }

  const includes = parseSmartDigestTerms(includeTerms)
  const matchedTerms: string[] = []
  const matchedFieldNames = new Set<string>()
  const matchedTermValues = new Set<string>()
  const reasonParts: string[] = []

  for (const term of includes) {
    const matchingFields = fields.filter((candidate) =>
      fieldMatches(candidate.value, term)
    )

    if (!matchingFields.length) {
      continue
    }

    for (const field of matchingFields) {
      matchedFieldNames.add(field.name)
    }

    if (matchedTermValues.has(term.value)) {
      continue
    }

    matchedTermValues.add(term.value)
    matchedTerms.push(term.value)
    reasonParts.push(
      `"${term.value}" in ${joinReasonParts(
        matchingFields.map((field) => field.name)
      )}`
    )
  }

  if (!matchedTerms.length) {
    return {
      matched: false,
      matchedFields: [],
      matchedTerms: [],
      reason: "No include terms matched.",
    }
  }

  return {
    matched: true,
    matchedFields: fields
      .filter((field) => matchedFieldNames.has(field.name))
      .map((field) => field.name),
    matchedTerms,
    reason: `Matched ${joinReasonParts(reasonParts)}.`,
  }
}

function articleFields(article: SmartDigestMatchArticle) {
  return [
    { name: "title", value: normalizeSearchText(article.title) },
    { name: "feedTitle", value: normalizeSearchText(article.feedTitle) },
    { name: "summary", value: normalizeSearchText(article.summary) },
    {
      name: "contentText",
      value: normalizeSearchText(article.contentText),
    },
  ]
}

function fieldMatches(value: string, term: SmartDigestParsedTerm) {
  if (!value) {
    return false
  }

  return termBoundaryPattern(term.value).test(value)
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeTerm(value: string) {
  return normalizeSearchText(value.replace(/^[-]+/, ""))
}

function parseArrayTerm(value: string): SmartDigestParsedTerm[] {
  const trimmed = value.trim()
  const phraseMatch = trimmed.match(/^-*"([^"]*)"$/)
  const raw = normalizeTerm(phraseMatch ? phraseMatch[1] : trimmed)

  if (!raw) {
    return []
  }

  return [
    {
      kind: phraseMatch ? "phrase" : "keyword",
      value: raw,
    },
  ]
}

function dedupeTerms(terms: SmartDigestParsedTerm[]) {
  const seen = new Set<string>()

  return terms.filter((term) => {
    const key = `${term.kind}:${term.value}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function termBoundaryPattern(value: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(value)}([^a-z0-9]|$)`, "i")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function joinReasonParts(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] || "selected terms"
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}
