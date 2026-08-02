import { NextResponse } from "next/server"

import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import { getPodcastEpisodeTranscriptForUser } from "@/lib/podcast-transcript"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  let userId: string

  try {
    userId = (await requireFreshUser()).id
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 })
    }

    throw error
  }

  const { episodeId } = await params

  try {
    const transcript = await getPodcastEpisodeTranscriptForUser({
      episodeId,
      userId,
    })

    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found." }, { status: 404 })
    }

    return NextResponse.json(transcript, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return NextResponse.json({ error: "Transcript is unavailable." }, { status: 502 })
  }
}
