import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Community Guidelines | Arctic RSS",
  description: "Community rules for ArcticIRC.",
}

export default function CommunityPage() {
  return (
    <LegalPageLayout description="Community rules for ArcticIRC." title="Community Guidelines">
      <ApprovedPolicyDocument policy="community" />
    </LegalPageLayout>
  )
}
