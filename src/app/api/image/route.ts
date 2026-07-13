import { NextRequest } from "next/server"

import {
  allowedImageContentType,
  IMAGE_PROXY_ACCEPT,
  IMAGE_PROXY_CACHE_CONTROL,
  IMAGE_PROXY_MAX_BYTES,
  IMAGE_PROXY_USER_AGENT,
} from "@/lib/image-proxy"
import {
  enforceRateLimit,
  getTrustedClientIp,
} from "@/lib/rate-limit"
import {
  FeedFetchError,
  normalizeHttpUrl,
  safeFetchBytes,
  UnsafeUrlError,
} from "@/lib/url-safety"

const MAX_IMAGE_URL_LENGTH = 4_096

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url")

  if (!source || source.length > MAX_IMAGE_URL_LENGTH) {
    return noStoreResponse(400)
  }

  const rateLimit = await enforceRateLimit({
    action: "image_proxy",
    ip: getTrustedClientIp(request.headers),
  })

  if (!rateLimit.allowed) {
    return noStoreResponse(rateLimit.reason === "unavailable" ? 503 : 429)
  }

  try {
    const image = await safeFetchBytes(normalizeHttpUrl(source), {
      accept: IMAGE_PROXY_ACCEPT,
      maxBytes: IMAGE_PROXY_MAX_BYTES,
      userAgent: IMAGE_PROXY_USER_AGENT,
    })
    const contentType = allowedImageContentType(image.contentType)

    if (!contentType) {
      return noStoreResponse(415)
    }

    return new Response(image.bytes as unknown as BodyInit, {
      headers: {
        "Cache-Control": IMAGE_PROXY_CACHE_CONTROL,
        "Content-Disposition": "inline",
        "Content-Type": contentType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    })
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return noStoreResponse(400)
    }

    if (error instanceof FeedFetchError && error.message.includes("timed out")) {
      return noStoreResponse(504)
    }

    return noStoreResponse(502)
  }
}

function noStoreResponse(status: number) {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}
