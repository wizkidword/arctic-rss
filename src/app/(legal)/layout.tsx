import type { ReactNode } from "react"

// The publication date is set in the production environment during an
// approved release, so legal pages must render it at request time.
export const dynamic = "force-dynamic"

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
