import { readFileSync } from "node:fs"
import { join } from "node:path"

export type ApprovedPolicyKey =
  | "community"
  | "cookies"
  | "privacy"
  | "retention"
  | "security"
  | "terms"

const policyBoundaries: Record<ApprovedPolicyKey, { end: string; start: string }> = {
  community: { end: "# 7. Retention and Deletion Policy", start: "## ArcticIRC Community Guidelines" },
  cookies: { end: "# 5. Replacement Security Page", start: "## Cookie Policy" },
  privacy: { end: "# 4. Replacement Cookie Policy", start: "## Privacy Policy" },
  retention: { end: "# 8. User-facing notices", start: "## Retention and Deletion Policy" },
  security: { end: "# 6. Community Guidelines", start: "## Security" },
  terms: { end: "# 3. Replacement Privacy Policy", start: "## Terms of Service" },
}

export function getApprovedPolicyMarkdown(policy: ApprovedPolicyKey) {
  const source = readFileSync(
    join(process.cwd(), "docs", "arcticirc", "arcticirc-launch-policy-package.md"),
    "utf8"
  ).replace(/\r\n/g, "\n")
  const boundary = policyBoundaries[policy]
  const startIndex = source.indexOf(boundary.start)
  const endIndex = source.indexOf(boundary.end, startIndex)

  if (startIndex < 0 || endIndex < 0) {
    throw new Error("The approved ArcticIRC policy package is incomplete.")
  }

  return source
    .slice(startIndex, endIndex)
    .replace(/^##[^\n]+\n+/, "")
    .replace(/\*\*Last updated:\*\* Use the actual publication date\.\n+/g, "")
    .replace(/\n+---\n*$/, "")
    .trim()
}

export function getPolicyPublicationDate(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const value = environment.ARCTICIRC_POLICY_PUBLICATION_DATE?.trim()

  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
