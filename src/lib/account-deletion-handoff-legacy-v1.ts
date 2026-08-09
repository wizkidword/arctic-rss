import { createHmac, scrypt } from "node:crypto"

const HANDOFF_PREFIX = "arcticrss-account-deletion-handoff"
const LEGACY_HANDOFF_VERSION = "v1"
const HANDOFF_SIGNATURE_BYTES = 32
const HANDOFF_SIGNATURE_DERIVATION_COST = 16_384
const HANDOFF_SIGNATURE_DERIVATION_CONTEXT = "arcticrss-account-deletion-handoff-v1"

/**
 * Verifies only handoffs issued before v2. New handoffs always use v2.
 *
 * The historic scrypt cost is part of the v1 signature format, so changing it
 * would invalidate a still-unexpired handoff. The caller validates the
 * compact, short-lived handoff before reaching this compatibility path and
 * then authenticates its result with the server-held HMAC secret.
 */
export async function signLegacyV1AccountDeletionHandoff(encodedPayload: string, secret: string) {
  const signingInput = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      `${HANDOFF_PREFIX}.${LEGACY_HANDOFF_VERSION}.${encodedPayload}`,
      HANDOFF_SIGNATURE_DERIVATION_CONTEXT,
      HANDOFF_SIGNATURE_BYTES,
      {
        N: HANDOFF_SIGNATURE_DERIVATION_COST,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.from(derivedKey))
      },
    )
  })

  return createHmac("sha256", secret).update(signingInput).digest()
}
