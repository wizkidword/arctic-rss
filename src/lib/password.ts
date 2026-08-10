import { compare, hash } from "bcryptjs"

import {
  assertBcryptPasswordByteLength,
  isBcryptPasswordByteLengthValid,
} from "@/lib/password-policy"

const PASSWORD_COST = 12

export function hashPassword(password: string) {
  assertBcryptPasswordByteLength(password)
  return hash(password, PASSWORD_COST)
}

export function verifyPassword(password: string, passwordHash: string) {
  if (!isBcryptPasswordByteLengthValid(password)) {
    return false
  }

  return compare(password, passwordHash)
}
