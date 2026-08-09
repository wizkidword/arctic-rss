import { createHmac } from "node:crypto"

/**
 * Signs a bounded account-deletion handoff with the server-held AUTH_SECRET.
 *
 * The signing input contains an already-derived, short-lived deletion-token
 * digest as authenticated cookie context; it is not a password storage hash.
 * CodeQL's password-hash query cannot distinguish that use from password
 * storage, so this single-purpose HMAC helper is excluded in the CodeQL config.
 */
export function signV2AccountDeletionHandoff(signingInput: string, secret: string) {
  return createHmac("sha256", secret).update(signingInput).digest()
}
