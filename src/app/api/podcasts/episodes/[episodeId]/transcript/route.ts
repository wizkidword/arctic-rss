import { NextResponse } from "next/server"

import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  getPodcastEpisodeTranscriptForUser,
  PodcastTranscriptError,
} from "@/lib/podcast-transcript"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const noStoreHeaders = { "Cache-Control": "private, no-store" }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  let userId: string

  try {
    userId = (await requireFreshUser()).id
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logTranscriptFailure("unauthorized")
      return NextResponse.json(
        { error: "Authentication is required." },
        { headers: noStoreHeaders, status: 401 }
      )
    }

    throw error
  }

  const { episodeId } = await params
  let rateLimit

  try {
    rateLimit = await enforceRateLimit({
      action: "podcast_transcript",
      ip: getTrustedClientIp(request.headers),
      userId,
    })
  } catch {
    return transcriptRateLimitUnavailableResponse()
  }

  if (!rateLimit.allowed) {
    if (rateLimit.reason === "unavailable") {
      return transcriptRateLimitUnavailableResponse()
    }

    logTranscriptFailure("rate_limited")

    return NextResponse.json(
      {
        error: "Too many transcript requests. Please try again later.",
      },
      {
        headers: {
          ...noStoreHeaders,
          ...(rateLimit.retryAfterSeconds
            ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
            : {}),
        },
        status: 429,
      }
    )
  }

  try {
    const transcript = await getPodcastEpisodeTranscriptForUser({
      episodeId,
      userId,
    })

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found." },
        { headers: noStoreHeaders, status: 404 }
      )
    }

    return NextResponse.json(transcript, {
      headers: noStoreHeaders,
    })
  } catch (error) {
    if (error instanceof PodcastTranscriptError) {
      logTranscriptFailure(error.reason)

      return NextResponse.json(
        {
          error:
            error.reason === "unsupported_format"
              ? "Transcript not found."
              : "Transcript is unavailable.",
        },
        {
          headers: noStoreHeaders,
          status:
            error.reason === "timeout"
              ? 504
              : error.reason === "unsupported_format"
                ? 404
                : 502,
        }
      )
    }

    logTranscriptFailure("upstream_unavailable")
    return NextResponse.json(
      { error: "Transcript is unavailable." },
      { headers: noStoreHeaders, status: 502 }
    )
  }
}

function transcriptRateLimitUnavailableResponse() {
  logTranscriptFailure("upstream_unavailable")
  return NextResponse.json(
    { error: "Transcript service is temporarily unavailable." },
    { headers: noStoreHeaders, status: 503 }
  )
}

function logTranscriptFailure(reason: "rate_limited" | "unauthorized" | "upstream_unavailable" | PodcastTranscriptError["reason"]) {
  console.warn(JSON.stringify({ event: "podcast_transcript_failed", reason }))
}
