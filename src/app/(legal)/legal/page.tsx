import Link from "next/link"
import type { Metadata } from "next"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Legal | Arctic RSS",
  description: "Privacy, terms, cookies, and security information for Arctic RSS.",
}

const policies = [
  {
    description: "How we collect, use, retain, and protect account and reader data.",
    href: "/privacy",
    label: "Privacy Policy",
  },
  {
    description: "The ground rules for accounts, feeds, AI summaries, tips, and service use.",
    href: "/terms",
    label: "Terms of Service",
  },
  {
    description: "The essential cookies and security tokens used to keep Arctic RSS working.",
    href: "/cookies",
    label: "Cookie Policy",
  },
  {
    description: "How to report vulnerabilities and what security behavior we ask of researchers.",
    href: "/security",
    label: "Security",
  },
]

export default function LegalPage() {
  return (
    <LegalPageLayout
      description="The fine print for Arctic RSS: privacy, terms, cookies, and security."
      title="Legal"
    >
      <PolicySection title="Policies">
        <p>
          These pages explain how Arctic RSS handles accounts, feeds, support
          requests, voluntary Ko-fi tips, and security reports. They are written
          as practical starter policies for the current free reader service.
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
