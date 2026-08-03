import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class PodcastTranscriptError extends Error {
    constructor(public readonly reason: string) {
      super("The transcript could not be retrieved safely.")
    }
  }

  return {
    AuthorizationError,
    PodcastTranscriptError,
    enforceRateLimit: vi.fn(),
    getPodcastEpisodeTranscriptForUser: vi.fn(),
    getTrustedClientIp: vi.fn(),
    requireFreshUser: vi.fn(),
  }
})

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))

vi.mock("@/lib/podcast-transcript", () => ({
  getPodcastEpisodeTranscriptForUser: mocks.getPodcastEpisodeTranscriptForUser,
  PodcastTranscriptError: mocks.PodcastTranscriptError,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { GET } from "./route"

describe("podcast transcript endpoint", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  function allowTranscript() {
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.20")
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getPodcastEpisodeTranscriptForUser.mockResolvedValue({
      cues: [{ text: "Hello." }],
      isCaptions: true,
      language: "en",
      type: "text/vtt",
    })
  }

  function transcriptRequest() {
    return new Request("https://arcticrss.com/api/podcasts/episodes/episode-1/transcript", {
      headers: { "cf-connecting-ip": "198.51.100.20" },
    })
  }

  function transcriptParams() {
    return { params: Promise.resolve({ episodeId: "episode-1" }) }
  }

  it("requires an authenticated subscriber before rate limiting or fetching", async () => {
    mocks.requireFreshUser.mockRejectedValue(new mocks.AuthorizationError())
    const securityLog = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(mocks.getPodcastEpisodeTranscriptForUser).not.toHaveBeenCalled()
    expect(securityLog).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"unauthorized"')
    )
  })

  it("enforces per-user and trusted-IP limits with Retry-After before fetching", async () => {
    allowTranscript()
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      reason: "limited",
      retryAfterSeconds: 300,
      scope: "user",
    })
    const securityLog = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("300")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "podcast_transcript",
      ip: "198.51.100.20",
      userId: "user-1",
    })
    expect(mocks.getPodcastEpisodeTranscriptForUser).not.toHaveBeenCalled()
    expect(securityLog).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"rate_limited"')
    )
  })

  it("fails closed when the transcript rate-limit store is unavailable", async () => {
    allowTranscript()
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false, reason: "unavailable" })

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBeNull()
    expect(mocks.getPodcastEpisodeTranscriptForUser).not.toHaveBeenCalled()
  })

  it("fails closed when rate-limit initialization throws", async () => {
    allowTranscript()
    mocks.enforceRateLimit.mockRejectedValue(new Error("Redis configuration unavailable"))

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(503)
    expect(mocks.getPodcastEpisodeTranscriptForUser).not.toHaveBeenCalled()
  })

  it("returns private transcript data only after authorization and limits pass", async () => {
    allowTranscript()

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toMatchObject({
      cues: [{ text: "Hello." }],
      type: "text/vtt",
    })
  })

  it("reports unsafe destinations without disclosing upstream URLs", async () => {
    allowTranscript()
    mocks.getPodcastEpisodeTranscriptForUser.mockRejectedValue(
      new mocks.PodcastTranscriptError("unsafe_destination")
    )
    const securityLog = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await GET(transcriptRequest(), transcriptParams())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: "Transcript is unavailable." })
    expect(securityLog).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"unsafe_destination"')
    )
    expect(securityLog).not.toHaveBeenCalledWith(expect.stringContaining("publisher"))
  })
})
