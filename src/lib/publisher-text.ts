export type PublisherTextDiagnostics = {
  carriageReturnsNormalized: number
  invalidXmlControlCharactersRemoved: number
  invalidUnicodeScalarsRemoved: number
  nullCharactersRemoved: number
  unicodeNormalizationApplied: number
}

export type NormalizedPublisherText = {
  diagnostics: PublisherTextDiagnostics
  value: string
}

export function normalizePublisherText(value: string): NormalizedPublisherText {
  return normalize(value, true)
}

export function normalizePublisherExternalIdentity(
  value: string
): NormalizedPublisherText {
  return normalize(value, false)
}

function normalize(value: string, normalizeUnicode: boolean): NormalizedPublisherText {
  let carriageReturnsNormalized = 0
  const lineEndingNormalized = value.replace(/\r\n?/g, () => {
    carriageReturnsNormalized += 1
    return "\n"
  })
  let invalidXmlControlCharactersRemoved = 0
  let nullCharactersRemoved = 0
  const controlsRemoved = lineEndingNormalized.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
    (character) => {
      if (character === "\u0000") {
        nullCharactersRemoved += 1
      } else {
        invalidXmlControlCharactersRemoved += 1
      }
      return ""
    }
  )
  const unicodeScalars = removeInvalidUnicodeScalars(controlsRemoved)
  const nfcValue = normalizeUnicode ? unicodeScalars.value.normalize("NFC") : unicodeScalars.value

  return {
    diagnostics: {
      carriageReturnsNormalized,
      invalidXmlControlCharactersRemoved,
      invalidUnicodeScalarsRemoved: unicodeScalars.removed,
      nullCharactersRemoved,
      unicodeNormalizationApplied: nfcValue === unicodeScalars.value ? 0 : 1,
    },
    value: nfcValue,
  }
}

function removeInvalidUnicodeScalars(value: string) {
  let removed = 0
  let result = ""

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)

      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1]
        index += 1
      } else {
        removed += 1
      }
      continue
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      removed += 1
      continue
    }

    result += value[index]
  }

  return { removed, value: result }
}
