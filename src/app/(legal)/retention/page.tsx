import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Retention and Deletion | Arctic RSS",
  description: "Retention and deletion commitments for ArcticRSS and ArcticIRC.",
}

export default function RetentionPage() {
  return (
    <LegalPageLayout
      description="Retention and deletion commitments for ArcticRSS and ArcticIRC."
      title="Retention and Deletion"
    >
      <ApprovedPolicyDocument policy="retention" />
    </LegalPageLayout>
  )
}
