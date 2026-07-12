import type { Metadata } from "next"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Privacy Policy | Arctic RSS",
  description: "How Arctic RSS collects, uses, and protects reader data.",
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      description="How Arctic RSS collects, uses, shares, and protects reader data."
      title="Privacy Policy"
    >
      <PolicySection title="Overview">
        <p>
          Arctic RSS is a web-based RSS reader. We collect the information needed
          to create accounts, authenticate readers, store feed subscriptions, and
          operate the service. Contact us at{" "}
          <a href="mailto:support@arcticrss.com">support@arcticrss.com</a> with
          privacy questions or account deletion requests.
        </p>
      </PolicySection>
      <PolicySection title="Information we collect">
        <ul className="list-disc pl-5">
          <li>Account details such as email address, username, name, and authentication records.</li>
          <li>Reader data such as feed URLs, folders, subscriptions, article metadata, read state, stars, saved preferences, display mode, theme, date format, and time zone.</li>
          <li>Support and email records when you contact us or request account actions such as verification or password reset.</li>
          <li>Analytics data from Google Analytics, such as page views, traffic sources, device/browser information, and approximate location.</li>
          <li>Security and operational data such as IP address, user agent, logs, rate-limit signals, and Cloudflare Turnstile verification results.</li>
        </ul>
      </PolicySection>
      <PolicySection title="How we use information">
        <ul className="list-disc pl-5">
          <li>To provide the reader, keep your account signed in, fetch feeds, and remember your settings.</li>
          <li>To send account emails such as verification, welcome, password reset, and support messages.</li>
          <li>To protect the service from spam, abuse, bots, and security threats.</li>
          <li>To diagnose bugs, monitor reliability, and improve Arctic RSS.</li>
        </ul>
      </PolicySection>
      <PolicySection title="AI summary features">
        <p>
          If you request an AI summary, Arctic RSS may process the selected
          article content, title, source, and related metadata to generate that
          summary. We will update this policy before adding paid AI features or
          materially changing the way third-party AI providers are used.
        </p>
      </PolicySection>
      <PolicySection title="Third-party services">
        <p>
          Arctic RSS uses third-party services to operate the product, including
          Google OAuth, Google/Gmail email delivery, Google Analytics,
          Cloudflare hosting, security, Turnstile, DNS, and Email Routing, and
          Ko-fi for voluntary reader tips. When you subscribe to feeds, feed
          publishers may receive requests from Arctic RSS servers as part of
          normal RSS fetching.
        </p>
      </PolicySection>
      <PolicySection title="Cookies and similar technologies">
        <p>
          We use essential cookies and similar tokens for authentication,
          security, CSRF protection, reader preferences, Cloudflare Turnstile,
          and Google Analytics traffic measurement. We do not currently use
          advertising cookies or sell personal information for targeted
          advertising.
        </p>
      </PolicySection>
      <PolicySection title="Retention and deletion">
        <p>
          We keep account and reader data while your account is active or as
          needed to operate, secure, and support the service. You can request
          account deletion by emailing support@arcticrss.com. Backups, logs, and
          records needed for security, fraud prevention, or legal compliance may
          persist for a limited period.
        </p>
      </PolicySection>
      <PolicySection title="Your choices">
        <p>
          You can update many reader settings in the app, unsubscribe from feeds,
          and contact us to request access, correction, export, or deletion of
          your account data. You can also control browser cookies in your
          browser, though blocking essential cookies may prevent login or core
          reader features from working.
        </p>
      </PolicySection>
      <PolicySection title="Children and international users">
        <p>
          Arctic RSS is not intended for children under 13. If you use Arctic RSS
          from outside the United States, your information may be processed in
          the United States and other locations where our service providers
          operate.
        </p>
      </PolicySection>
      <PolicySection title="Changes">
        <p>
          We may update this Privacy Policy as Arctic RSS changes. Material
          updates will be posted on this page with a new last updated date.
        </p>
      </PolicySection>
    </LegalPageLayout>
  )
}
