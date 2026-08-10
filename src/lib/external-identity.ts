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
