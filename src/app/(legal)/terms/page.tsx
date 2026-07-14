import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Terms of Service | Arctic RSS",
  description: "Terms that apply to Arctic RSS and ArcticIRC.",
}

export default function TermsPage() {
  return (
    <LegalPageLayout description="Terms that apply to Arctic RSS and ArcticIRC." title="Terms of Service">
      <ApprovedPolicyDocument policy="terms" />
    </LegalPageLayout>
  )
}
