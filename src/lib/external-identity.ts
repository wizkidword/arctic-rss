import { createHash } from "node:crypto"

import { normalizePublisherExternalIdentity } from "./publisher-text"

export const EXTERNAL_ID_HASH_ALGORITHM = "sha256"

/**
 * The identity is decoded by the XML parser, stripped of unsafe publisher
 * characters, normalized to LF line endings, and trimmed without applying
 * Unicode NFC. This preserves publisher identifier semantics while creating a
 * fixed-length database key.
 */
export function externalIdentityHash(externalId: string) {
  const normalized = normalizePublisherExternalIdentity(externalId).value.trim()

  return createHash(EXTERNAL_ID_HASH_ALGORITHM).update(normalized, "utf8").digest("hex")
}

export function countExternalIdentityHashCollisionCandidates(
  inputs: Array<{ externalId: string; hash: string; scopeId: string }>
) {
  const rawIdsByScopedHash = new Map<string, Set<string>>()

  for (const input of inputs) {
    const key = `${input.scopeId}:${input.hash}`
    const rawIds = rawIdsByScopedHash.get(key) ?? new Set<string>()
    rawIds.add(input.externalId)
    rawIdsByScopedHash.set(key, rawIds)
  }

  return inputs.filter((input) => {
    const rawIds = rawIdsByScopedHash.get(`${input.scopeId}:${input.hash}`)

    return (rawIds?.size ?? 0) > 1
  }).length
}
