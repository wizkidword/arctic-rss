# Arctic RSS Publisher-Supplied Podcast Transcripts

## Outcome

A signed-in podcast subscriber can open a publisher-advertised transcript beside an episode, search its displayed text, and jump timestamped cues in the existing audio player.

## First release

- Read `podcast:transcript` elements from a podcast RSS item.
- Persist one preferred text transcript reference per episode: WebVTT first, then SubRip, then plain text.
- Fetch the selected transcript only when its subscriber opens it, through the existing server-side URL-safety controls.
- Render WebVTT and SubRip as timestamped cues; render plain text as untimed blocks.
- Keep filtering and cue-to-player seeking in a small client component. The server supplies only plain, serializable transcript metadata.
- Clearly label the viewer and link as publisher-supplied.

## Authorization and safety

- The transcript endpoint must require a signed-in user with a subscription to the episode's podcast.
- The endpoint uses the existing safe text fetcher with a bounded response size. The browser never fetches publisher transcript URLs directly.
- Persist transcript metadata, never transcript body text. A failed or unavailable publisher transcript does not change episode state or feed health.
- Treat declared MIME type as a format hint and support only `text/vtt`, `application/x-subrip`, and `text/plain` in this release.

## Non-goals

- Generated transcripts, transcription providers, audio downloads, publisher-page scraping, HTML or JSON transcript formats.
- Background fetching, indexing transcript text in the global article search, retaining transcript bodies, or cross-episode search.
- Selecting among languages or transcript formats in the UI. The parser selects one deterministic preferred text format.

## Data and flow

`PodcastEpisode` gains nullable transcript URL, MIME type, language, and relation fields. Feed refreshes update this metadata together with the existing episode fields.

When a user opens the transcript viewer, `GET /api/podcasts/episodes/[episodeId]/transcript` authorizes access, safely retrieves the reference, parses the supported text format into bounded cues, and returns plain JSON. The viewer filters cue text locally and seeks the episode's existing audio element when a timed cue is chosen.

## Acceptance checks

- Parser accepts valid Podcasting 2.0 transcript metadata and deterministically prefers WebVTT over SubRip and plain text.
- Refresh creates and updates transcript metadata without removing it when an unchanged or unsupported item is encountered.
- Unauthorized users cannot retrieve a transcript reference or body.
- The endpoint rejects absent or unsupported references and does not make a network call before authorization.
- Viewer exposes a publisher-supplied label, in-episode search, loading/error states, and timestamp seeking.
- Existing podcast subscription, refresh, playback, and article-reader behavior remains unchanged.
