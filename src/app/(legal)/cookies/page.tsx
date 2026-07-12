import type { Metadata } from "next"

import { LegalPageLayout, PolicySection } from "../legal-page-layout"

export const metadata: Metadata = {
  title: "Cookie Policy | Arctic RSS",
  description: "How Arctic RSS uses cookies and similar technologies.",
}

export default function CookiesPage() {
  return (
    <LegalPageLayout
      description="The cookies and similar technologies Arctic RSS uses."
      title="Cookie Policy"
    >
      <PolicySection title="Overview">
        <p>
          Arctic RSS currently uses essential cookies and similar browser storage
          only for core account, reader, preference, and security features. We do
          not currently use advertising cookies.
        </p>
      </PolicySection>
      <PolicySection title="Essential cookies">
        <p>
          Essential cookies keep you signed in, protect forms from CSRF attacks,
          remember reader settings, and support account security. If you block
          essential cookies, login and parts of the reader may not work.
        </p>
      </PolicySection>
      <PolicySection title="Security checks">
        <p>
          Arctic RSS uses Cloudflare Turnstile and Cloudflare security services
          to detect abuse, reduce spam, and protect login, signup, and password
          reset flows. These services may set or read security tokens needed to
          complete checks.
        </p>
      </PolicySection>
      <PolicySection title="Preference storage">
        <p>
          Arctic RSS may store reader preferences such as theme, display mode,
          date format, time format, and time zone so the app feels consistent
          across visits.
        </p>
      </PolicySection>
      <PolicySection title="Analytics and advertising">
        <p>
          Arctic RSS uses Google Analytics to understand aggregate traffic,
          pages visited, and product usage patterns. We do not use advertising
          cookies, behavioral advertising tags, or sell personal information for
          targeted advertising.
        </p>
      </PolicySection>
      <PolicySection title="Your controls">
        <p>
          You can delete or block cookies in your browser settings. Browser
          controls may affect all sites you visit, and blocking required cookies
          may prevent Arctic RSS from working correctly.
        </p>
      </PolicySection>
      <PolicySection title="Questions">
        <p>
          Questions about cookies can be sent to{" "}
          <a href="mailto:support@arcticrss.com">support@arcticrss.com</a>.
        </p>
      </PolicySection>
    </LegalPageLayout>
  )
}
