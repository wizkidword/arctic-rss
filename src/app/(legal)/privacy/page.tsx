import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Privacy Policy | Arctic RSS",
  description: "How Arctic RSS and ArcticIRC handle information.",
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout description="How Arctic RSS and ArcticIRC handle information." title="Privacy Policy">
      <ApprovedPolicyDocument policy="privacy" />
    </LegalPageLayout>
  )
}
