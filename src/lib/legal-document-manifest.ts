import { createHash } from "node:crypto"

import {
  getApprovedPolicyMarkdown,
  getPolicyPublicationDate,
  type ApprovedPolicyKey,
} from "@/lib/approved-policy"
import {
  ACCOUNT_DELETION_POLICY_VERSION,
  CHAT_POLICY_VERSION,
  COOKIE_POLICY_VERSION,
  LEGACY_ACCOUNT_DELETION_POLICY_VERSION,
  PRIVACY_POLICY_VERSION,
  RETENTION_POLICY_VERSION,
  SECURITY_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal-policy-versions"

export type LegalDocumentIdentifier =
  | "terms"
  | "privacy"
  | "account-deletion"
  | "chat"
  | "retention"
  | "cookies"
  | "security"

type LegalDocumentDefinition = {
  auditRecordType: "AccountDeletionRecord" | "ChatPolicyAcceptance" | null
  policy: ApprovedPolicyKey
  title: string
  version: string
}

export type LegalDocumentManifestEntry = LegalDocumentDefinition & {
  documentHash: string
  effectiveDate: string | null
  identifier: LegalDocumentIdentifier
  publicationDate: string | null
}

const legalDocuments: Record<LegalDocumentIdentifier, LegalDocumentDefinition> = {
  terms: {
    auditRecordType: null,
    policy: "terms",
    title: "Terms of Service",
    version: TERMS_VERSION,
  },
  privacy: {
    auditRecordType: null,
    policy: "privacy",
    title: "Privacy Policy",
    version: PRIVACY_POLICY_VERSION,
  },
  "account-deletion": {
    auditRecordType: "AccountDeletionRecord",
    policy: "retention",
    title: "Account Deletion Policy",
    version: ACCOUNT_DELETION_POLICY_VERSION,
  },
  chat: {
    auditRecordType: "ChatPolicyAcceptance",
    policy: "community",
    title: "Chat Policy",
    version: CHAT_POLICY_VERSION,
  },
  retention: {
    auditRecordType: null,
    policy: "retention",
    title: "Retention and Deletion Policy",
    version: RETENTION_POLICY_VERSION,
  },
  cookies: {
    auditRecordType: null,
    policy: "cookies",
    title: "Cookie Policy",
    version: COOKIE_POLICY_VERSION,
  },
  security: {
    auditRecordType: null,
    policy: "security",
    title: "Security Policy",
    version: SECURITY_POLICY_VERSION,
  },
}

function getDocumentHash(policy: ApprovedPolicyKey) {
  return createHash("sha256")
    .update(getApprovedPolicyMarkdown(policy))
    .digest("hex")
}

function toManifestEntry(
  identifier: LegalDocumentIdentifier,
  environment: Readonly<Record<string, string | undefined>>
): LegalDocumentManifestEntry {
  const document = legalDocuments[identifier]
  const publicationDate = getPolicyPublicationDate(environment)

  return {
    ...document,
    documentHash: getDocumentHash(document.policy),
    effectiveDate: publicationDate,
    identifier,
    publicationDate,
  }
}

export function getLegalDocumentManifest(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return (Object.keys(legalDocuments) as LegalDocumentIdentifier[]).map((identifier) =>
    toManifestEntry(identifier, environment)
  )
}

export function getLegalDocument(
  identifier: LegalDocumentIdentifier,
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return toManifestEntry(identifier, environment)
}

export function getAccountDeletionPolicyRecord(version: string) {
  if (version === ACCOUNT_DELETION_POLICY_VERSION) {
    return getLegalDocument("account-deletion")
  }

  if (version === LEGACY_ACCOUNT_DELETION_POLICY_VERSION) {
    return {
      auditRecordType: "AccountDeletionRecord" as const,
      identifier: "chat" as const,
      legacy: true,
      title: "Legacy account deletion policy reference",
      version,
    }
  }

  return null
}
