import { NextRequest, NextResponse } from "next/server"

import {
  buildEmailVerificationLoginUrl,
  verifyEmailWithToken,
} from "@/lib/email-verification"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(
      buildEmailVerificationLoginUrl("verifyError")
    )
  }

  const result = await verifyEmailWithToken(token)

  return NextResponse.redirect(
    buildEmailVerificationLoginUrl(
      result.status === "verified" ? "verified" : "verifyError"
    )
  )
}
