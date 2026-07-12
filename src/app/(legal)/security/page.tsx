import type { Metadata } from "next"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Security | Arctic RSS",
  description: "How to report security issues to Arctic RSS.",
}

export default function SecurityPage() {
  return (
    <LegalPageLayout
      description="How to report vulnerabilities and help keep Arctic RSS safe."
      title="Security"
    >
      <PolicySection title="Vulnerability disclosure">
        <p>
          If you believe you found a vulnerability in Arctic RSS, email{" "}
          <a href="mailto:support@arcticrss.com">support@arcticrss.com</a> with
          enough detail for us to understand and reproduce the issue. Please
          include affected URLs, steps to reproduce, browser or tool details, and
          the potential impact.
        </p>
      </PolicySection>
      <PolicySection title="Research guidelines">
        <ul className="list-disc pl-5">
          <li>Do not access, modify, delete, or expose data that does not belong to you.</li>
          <li>Do not disrupt service, run destructive tests, or attempt denial-of-service attacks.</li>
          <li>Do not use social engineering, phishing, spam, or physical attacks.</li>
          <li>Give us reasonable time to investigate before publicly disclosing an issue.</li>
        </ul>
      </PolicySection>
      <PolicySection title="Scope">
        <p>
          The primary scope is the Arctic RSS web app at arcticrss.com and its
          account, reader, authentication, feed, and support flows. Third-party
          services such as Google, Cloudflare, Ko-fi, and feed publishers are
          governed by their own security programs.
        </p>
      </PolicySection>
      <PolicySection title="No bug bounty">
        <p>
          Arctic RSS does not currently run a paid bug bounty program. Reports
          are appreciated, but we cannot guarantee payment, rewards, or public
          recognition.
        </p>
      </PolicySection>
      <PolicySection title="Account security">
        <p>
          Use a strong unique password or Google OAuth, keep access to your email
          account secure, and contact support@arcticrss.com if you suspect
          unauthorized access.
        </p>
      </PolicySection>
    </LegalPageLayout>
  )
}
