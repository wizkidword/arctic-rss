import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Security | Arctic RSS",
  description: "Security information for Arctic RSS and ArcticIRC.",
}

export default function SecurityPage() {
  return (
    <LegalPageLayout description="Security information for Arctic RSS and ArcticIRC." title="Security">
      <ApprovedPolicyDocument policy="security" />
    </LegalPageLayout>
  )
}
