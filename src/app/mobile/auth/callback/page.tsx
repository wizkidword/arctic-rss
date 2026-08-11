import { MobileAuthCallbackFallback } from "./mobile-auth-callback-fallback"

export const metadata = {
  robots: { index: false, follow: false },
  title: "Return to Arctic RSS",
}

// The authorization result is handled by Android as an HTTPS App Link. This
// page is only the browser fallback and never renders its query string.
export default function MobileAuthCallbackPage() {
  return <MobileAuthCallbackFallback />
}
