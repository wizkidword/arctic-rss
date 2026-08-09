export const PASSWORD_MINIMUM_LENGTH = 8
export const BCRYPT_MAX_PASSWORD_BYTES = 72
export const BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE =
  "Password must use no more than 72 UTF-8 bytes."
export const PASSWORD_REQUIREMENTS =
  "Use at least 8 characters and no more than 72 UTF-8 bytes. Emoji and accented characters can use more than one byte."

export function getPasswordUtf8ByteLength(password: string) {
  return new TextEncoder().encode(password).byteLength
}

export function isBcryptPasswordByteLengthValid(password: string) {
  return getPasswordUtf8ByteLength(password) <= BCRYPT_MAX_PASSWORD_BYTES
}

export function assertBcryptPasswordByteLength(password: string) {
  if (!isBcryptPasswordByteLengthValid(password)) {
    throw new Error(BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE)
  }
}
