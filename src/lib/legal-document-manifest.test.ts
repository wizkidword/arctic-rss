import { describe, expect, it } from "vitest"

import {
  getAccountDeletionPolicyRecord,
  getLegalDocumentManifest,
} from "./legal-document-manifest"
import {
  ACCOUNT_DELETION_POLICY_VERSION,
  CHAT_POLICY_VERSION,
  COOKIE_POLICY_VERSION,
  PRIVACY_POLICY_VERSION,
  RETENTION_POLICY_VERSION,
  SECURITY_POLICY_VERSION,
  TERMS_VERSION,
} from "./legal-policy-versions"

describe("legal document manifest", () => {
  it("publishes independent version identifiers and reproducible document hashes", () => {
    const manifest = getLegalDocumentManifest({
      ARCTICIRC_POLICY_PUBLICATION_DATE: "2026-08-02",
    })

    expect(manifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identifier: "terms", version: TERMS_VERSION }),
        expect.objectContaining({ identifier: "privacy", version: PRIVACY_POLICY_VERSION }),
        expect.objectContaining({
          auditRecordType: "AccountDeletionRecord",
          identifier: "account-deletion",
          version: ACCOUNT_DELETION_POLICY_VERSION,
        }),
        expect.objectContaining({ identifier: "chat", version: CHAT_POLICY_VERSION }),
        expect.objectContaining({ identifier: "retention", version: RETENTION_POLICY_VERSION }),
        expect.objectContaining({ identifier: "cookies", version: COOKIE_POLICY_VERSION }),
        expect.objectContaining({ identifier: "security", version: SECURITY_POLICY_VERSION }),
      ])
    )

    for (const document of manifest) {
      expect(document.documentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(document.effectiveDate).toBe("2026-08-02")
      expect(document.publicationDate).toBe("2026-08-02")
    }
  })

  it("keeps historic deletion records interpretable without rewriting their policy version", () => {
    expect(getAccountDeletionPolicyRecord(ACCOUNT_DELETION_POLICY_VERSION)).toEqual(
      expect.objectContaining({
        auditRecordType: "AccountDeletionRecord",
        identifier: "account-deletion",
        version: ACCOUNT_DELETION_POLICY_VERSION,
      })
    )
    expect(getAccountDeletionPolicyRecord(CHAT_POLICY_VERSION)).toEqual(
      expect.objectContaining({
        auditRecordType: "AccountDeletionRecord",
        identifier: "chat",
        legacy: true,
        version: CHAT_POLICY_VERSION,
      })
    )
  })
})
