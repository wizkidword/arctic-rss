import type { Metadata } from "next"

import { ApprovedPolicyDocument } from "@/components/approved-policy-document"

import { LegalPageLayout } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Cookie Policy | Arctic RSS",
  description: "Cookie and browser-storage choices for Arctic RSS and ArcticIRC.",
}

export default function CookiesPage() {
  return (
    <LegalPageLayout
      description="Cookie and browser-storage choices for Arctic RSS and ArcticIRC."
      title="Cookie Policy"
    >
      <ApprovedPolicyDocument policy="cookies" />
    </LegalPageLayout>
  )
}
