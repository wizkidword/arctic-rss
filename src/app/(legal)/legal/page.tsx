import Link from "next/link"
import type { Metadata } from "next"

import { getLegalDocument, type LegalDocumentIdentifier } from "@/lib/legal-document-manifest"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Legal | Arctic RSS",
  description: "Privacy, terms, cookies, and security information for Arctic RSS.",
}

const policies = [
  {
    description: "Standards for constructive, safe community discussion in ArcticIRC.",
    documentIdentifier: "chat" as const,
    href: "/community",
    label: "Community Guidelines",
  },
  {
    description: "How Arctic RSS and ArcticIRC handle information.",
    documentIdentifier: "privacy" as const,
    href: "/privacy",
    label: "Privacy Policy",
  },
  {
    description: "The terms that apply to Arctic RSS and ArcticIRC.",
    documentIdentifier: "terms" as const,
    href: "/terms",
    label: "Terms of Service",
  },
  {
    description: "Browser-storage and analytics choices for Arctic RSS and ArcticIRC.",
    documentIdentifier: "cookies" as const,
    href: "/cookies",
    label: "Cookie Policy",
  },
  {
    description: "Security practices and responsible disclosure information.",
    documentIdentifier: "security" as const,
    href: "/security",
    label: "Security",
  },
  {
    description: "How long ArcticIRC data is kept and how deletion requests work.",
    documentIdentifier: "retention" as const,
    href: "/retention",
    label: "Retention and Deletion",
  },
] satisfies Array<{ description: string; documentIdentifier: LegalDocumentIdentifier; href: string; label: string }>

export default function LegalPage() {
  return (
    <LegalPageLayout
      description="Policies for Arctic RSS and ArcticIRC."
      title="Legal"
    >
      <PolicySection title="Policies">
        <p>
          These policies are the published source of truth for Arctic RSS and
          ArcticIRC. ArcticIRC remains feature-gated until its launch requirements
          are configured and verified by the operator.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy) => (
            <Link
              className="rounded-lg border border-sky-100 bg-sky-50/50 p-4 transition hover:bg-sky-50"
              href={policy.href}
              key={policy.href}
            >
              <span className="block font-heading text-base font-semibold text-slate-950">
                {policy.label}
              </span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">
                {policy.description}
              </span>
              <span className="mt-2 block text-xs text-slate-500">
                Version {getLegalDocument(policy.documentIdentifier).version}
              </span>
            </Link>
          ))}
        </div>
      </PolicySection>
      <PolicySection title="Contact">
        <p>
          Questions about these policies can be sent to{" "}
          <a href="mailto:support@arcticrss.com">support@arcticrss.com</a>.
        </p>
      </PolicySection>
    </LegalPageLayout>
  )
}
