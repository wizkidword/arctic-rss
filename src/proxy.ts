import { NextRequest, NextResponse } from "next/server"

const HSTS_HEADER = "max-age=31536000; includeSubDomains"

function getPublicHost(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host

  return host.split(",")[0]?.trim() || request.nextUrl.hostname
}

function isLocalHost(host: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
}

function isHttpRequest(request: NextRequest) {
  const host = getPublicHost(request)
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const cfVisitor = request.headers.get("cf-visitor")

  if (isLocalHost(host)) {
    return false
  }

  return (
    forwardedProto === "http" ||
    cfVisitor?.includes('"scheme":"http"') === true
  )
}

function isHttpsRequest(request: NextRequest) {
  const host = getPublicHost(request)
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const cfVisitor = request.headers.get("cf-visitor")

  if (isLocalHost(host)) {
    return false
  }

  return (
    forwardedProto === "https" ||
    cfVisitor?.includes('"scheme":"https"') === true ||
    request.nextUrl.protocol === "https:"
  )
}

export function proxy(request: NextRequest) {
  if (isHttpRequest(request)) {
    const host = getPublicHost(request)
    const secureUrl = request.nextUrl.clone()
    secureUrl.protocol = "https:"
    secureUrl.host = host
    secureUrl.port = ""

    return NextResponse.redirect(secureUrl, 308)
  }

  const response = NextResponse.next()

  if (isHttpsRequest(request)) {
    response.headers.set("Strict-Transport-Security", HSTS_HEADER)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
