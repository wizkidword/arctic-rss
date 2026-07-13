import { NextRequest, NextResponse } from "next/server"

import {
  buildAppUrl,
  getAppOrigin,
  isAllowedAppHost,
  isLoopbackHost,
  normalizeRequestHost,
} from "@/lib/app-origin"

const HSTS_HEADER = "max-age=31536000; includeSubDomains"

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")
  const normalizedHost = normalizeRequestHost(host)
  const isHealthCheck =
    request.nextUrl.pathname === "/api/health" && isLoopbackHost(host)

  if (!isHealthCheck && !isAllowedAppHost(host)) {
    return new NextResponse("Invalid host.", { status: 400 })
  }

  const canonicalOrigin = getAppOrigin()

  if (!isHealthCheck && normalizedHost !== canonicalOrigin.host) {
    return NextResponse.redirect(
      buildAppUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`),
      308
    )
  }

  const response = NextResponse.next()

  if (!isHealthCheck && canonicalOrigin.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", HSTS_HEADER)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
