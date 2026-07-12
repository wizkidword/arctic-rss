import type { Metadata } from "next"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Terms of Service | Arctic RSS",
  description: "The terms that apply when using Arctic RSS.",
}

export default function TermsPage() {
  return (
    <LegalPageLayout
      description="The ground rules for using Arctic RSS."
      title="Terms of Service"
    >
      <PolicySection title="Acceptance">
        <p>
          By creating an account or using Arctic RSS, you agree to these Terms of
          Service and the related Privacy Policy, Cookie Policy, and Security
          page. If you do not agree, do not use the service.
        </p>
      </PolicySection>
      <PolicySection title="Accounts">
        <p>
          You are responsible for your account, credentials, feed subscriptions,
          and activity. Use accurate account information, keep your password
          secure, and notify us at support@arcticrss.com if you believe your
          account has been compromised.
        </p>
      </PolicySection>
      <PolicySection title="Reader content and feeds">
        <p>
          Arctic RSS helps you subscribe to and read third-party RSS feeds. Feed
          articles, images, trademarks, and linked pages belong to their original
          publishers. We are not responsible for the accuracy, legality,
          availability, or content of third-party feeds or sites.
        </p>
      </PolicySection>
      <PolicySection title="Acceptable use">
        <ul className="list-disc pl-5">
          <li>Do not use Arctic RSS for unlawful, abusive, harassing, or harmful activity.</li>
          <li>Do not attempt to bypass security, access accounts you do not own, or interfere with the service.</li>
          <li>Do not overload the service, automate abusive requests, or use feeds designed to attack readers or infrastructure.</li>
          <li>Do not use Arctic RSS to infringe copyrights, trademarks, privacy rights, or other rights.</li>
        </ul>
      </PolicySection>
      <PolicySection title="AI summaries">
        <p>
          AI summaries are optional convenience features. They may be incomplete,
          inaccurate, or omit context. Do not rely on them as legal, financial,
          medical, or other professional advice.
        </p>
      </PolicySection>
      <PolicySection title="Tips and future paid plans">
        <p>
          Ko-fi tips are voluntary support for the project and are processed by
          Ko-fi. Tips are not a purchase of a subscription, support guarantee, or
          paid feature entitlement. If Arctic RSS adds paid plans later, we will
          publish plan terms and any refund policy before charging for them.
        </p>
      </PolicySection>
      <PolicySection title="Service availability">
        <p>
          Arctic RSS is provided as available. We may change, suspend, limit, or
          discontinue parts of the service, including beta or experimental
          features. We may also suspend or terminate accounts that violate these
          terms or create risk for the service or other users.
        </p>
      </PolicySection>
      <PolicySection title="Disclaimers and limits">
        <p>
          To the fullest extent allowed by law, Arctic RSS is provided without
          warranties of any kind. We are not liable for indirect, incidental,
          special, consequential, or punitive damages, or for lost data, lost
          profits, feed outages, third-party content, or unavailable features.
        </p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:support@arcticrss.com">support@arcticrss.com</a>.
        </p>
      </PolicySection>
    </LegalPageLayout>
  )
}
