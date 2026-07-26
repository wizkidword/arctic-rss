import { NextRequest, NextResponse } from "next/server"

import {
  buildContentSecurityPolicy,
  CSP_NONCE_HEADER,
} from "@/lib/content-security-policy"
import {
  buildAppUrl,
  getAppOrigin,
  isAllowedAppHost,
  isLoopbackHost,
  normalizeRequestHost,
} from "@/lib/app-origin"

const HSTS_HEADER = "max-age=31536000; includeSubDomains"
const INVALID_HOST_CACHE_CONTROL = "no-store"

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")
  const normalizedHost = normalizeRequestHost(host)
  const isInternalHealthProbe =
    ["/api/health", "/api/live"].includes(request.nextUrl.pathname) &&
    isLoopbackHost(host)

  if (!isInternalHealthProbe && !isAllowedAppHost(host)) {
    console.warn(
      "host_validation_rejected",
      JSON.stringify({
        host: host?.slice(0, 256) ?? null,
        pathname: request.nextUrl.pathname,
      })
    )

    return new NextResponse("Invalid host.", {
      headers: { "Cache-Control": INVALID_HOST_CACHE_CONTROL },
      status: 400,
    })
  }

  if (request.nextUrl.pathname === "/api/live" && !isLoopbackHost(host)) {
    return new NextResponse("Not found.", { status: 404 })
  }

  const canonicalOrigin = getAppOrigin()

  if (!isInternalHealthProbe && normalizedHost !== canonicalOrigin.host) {
    return NextResponse.redirect(
      buildAppUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`),
      308
    )
  }

  const requestHeaders = new Headers(request.headers)
  const nonce = request.nextUrl.pathname.startsWith("/api/")
    ? null
    : Buffer.from(crypto.randomUUID()).toString("base64")
  const policy = nonce ? buildContentSecurityPolicy(nonce) : null

  if (policy && nonce) {
    requestHeaders.set(CSP_NONCE_HEADER, nonce)
    requestHeaders.set("Content-Security-Policy", policy)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  if (!isInternalHealthProbe && canonicalOrigin.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", HSTS_HEADER)
  }

  if (policy) {
    response.headers.set("Content-Security-Policy", policy)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
