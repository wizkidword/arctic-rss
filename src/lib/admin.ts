export function parseAdminEmails(value: string | null | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string[]
): boolean {
  if (!email) {
    return false
  }

  return adminEmails.includes(email.trim().toLowerCase())
}
