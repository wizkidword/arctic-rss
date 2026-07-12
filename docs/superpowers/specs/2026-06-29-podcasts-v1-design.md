# Arctic RSS Podcasts V1 Design

## Summary

Arctic RSS will add a separate first-class Podcasts section for podcast RSS subscriptions and streaming episodes. Podcasts will not appear in All Articles, but podcast episodes can be starred and saved into the same Collections system as articles.

The first release focuses on subscribing, discovering, browsing, streaming, and resuming podcast episodes. It does not try to become a full podcast client with downloads, OPML import/export, queue management, or web-wide podcast search.

## Goals

- Add a dedicated Podcasts area that feels related to Arctic RSS but not mixed into the article reader.
- Let users subscribe to podcasts by RSS URL.
- Add a curated Discover Podcasts page with category browsing and search across the curated directory.
- Stream podcast audio from the original enclosure URL without storing audio files on Arctic RSS servers.
- Remember playback progress per user and episode.
- Support episode actions: play, pause, seek, open original, star, save to collection, mark played, and mark unplayed.
- Count podcast subscriptions and feed subscriptions together under the shared free-plan source limit.

## Non-Goals

- Podcast OPML import/export.
- Downloading or caching podcast audio.
- Offline listening.
- Full podcast queue/history/playlists.
- Searching the wider podcast ecosystem through an external directory API.
- Automatic transcripts.
- Mixing podcast episodes into All Articles, Unread, or the article feed views.

## Navigation And Routes

Add a Podcasts entry to the signed-in left navigation.

Routes:

- `/app/podcasts`: Podcasts home using the approved hybrid layout.
- `/app/podcasts/discover`: Curated podcast discovery, category browsing, curated search, and paste-RSS subscribe.
- `/app/podcasts/[podcastId]`: Show detail page with podcast metadata and episodes.

An episode detail route should only be added if the implementation needs stable shareable episode URLs. V1 can start with episode selection inside the Podcasts home and show pages.

## Podcasts Home UX

Use the approved hybrid layout:

- Left area: subscribed shows with artwork, title, newest episode date, and unplayed count.
- Right area: latest episodes across subscribed shows.
- Bottom area: persistent mini-player once playback starts.

The empty state should send new podcast users to Discover Podcasts and offer a paste-RSS action. This empty state should not affect the article onboarding redirect to Discover feeds.

## Discover Podcasts UX

Discover Podcasts is separate from the existing Discover feeds page.

The page includes:

- Category cards for curated podcast groups.
- Search within the curated podcast directory only.
- Podcast result rows/cards with artwork, title, publisher/author, short description, and subscribe button.
- Paste-RSS subscribe control for shows not listed in the directory.

Initial directory categories should be broad and familiar, for example News, Technology, Business, Comedy, True Crime, Sports, Science, History, Culture, and Entertainment. Exact seed shows can be added during implementation.

## Data Model

Use separate podcast models instead of extending the existing Feed and Article tables.

Suggested models:

- `Podcast`
  - `id`
  - `feedUrl`
  - `siteUrl`
  - `title`
  - `description`
  - `artworkUrl`
  - `author`
  - `language`
  - `lastFetchedAt`
  - `lastSuccessfulFetchAt`
  - `lastFailedAt`
  - `lastError`
  - `etag`
  - `lastModified`
  - `refreshIntervalMinutes`
  - timestamps

- `PodcastSubscription`
  - `id`
  - `userId`
  - `podcastId`
  - `customTitle`
  - `sortOrder`
  - `isMuted`
  - `isPaused`
  - `subscribedAt`
  - timestamps

- `PodcastEpisode`
  - `id`
  - `podcastId`
  - `externalId`
  - `title`
  - `url`
  - `description`
  - `contentHtml`
  - `contentText`
  - `audioUrl`
  - `audioType`
  - `audioLengthBytes`
  - `durationSeconds`
  - `imageUrl`
  - `publishedAt`
  - timestamps

- `PodcastEpisodeState`
  - `id`
  - `userId`
  - `episodeId`
  - `isPlayed`
  - `isStarred`
  - `playbackPositionSeconds`
  - `playedAt`
  - `starredAt`
  - timestamps

Indexes should support looking up a user's podcast subscriptions, newest episodes across subscribed podcasts, and state for visible episodes.

## Collections

Collections become mixed media. A collection item can reference either an article or a podcast episode.

Collection behavior:

- Existing article collection behavior remains unchanged.
- Podcast episode rows can save/remove an episode from collections.
- Collection detail pages should show a compact type indicator so users can distinguish articles from podcast episodes.
- A collection can contain both articles and podcast episodes.

The data model should enforce that a collection item points to exactly one supported content type.

## Subscription Limit

Free users get a shared 200-source limit across feeds and podcasts.

Behavior:

- Existing feed subscriptions count toward the limit.
- Podcast subscriptions count toward the same limit.
- Error copy should use "sources" rather than "feeds" once podcasts exist.
- Admin and paid plans can retain existing higher/no-limit behavior unless plan rules are expanded later.

## Podcast Parsing And Refresh

Podcast RSS parsing should reuse feed parsing patterns where practical, but stay in podcast-specific modules.

Required podcast fields:

- Show title.
- Show description.
- Show artwork from podcast/iTunes image tags where available.
- Episode title.
- Episode GUID or stable external id.
- Episode page URL.
- Audio enclosure URL.
- Audio MIME type.
- Duration when present.
- Published date when present.

Refresh behavior should mirror feed refresh:

- Store fetch timestamps and latest error on `Podcast`.
- Preserve `etag` and `lastModified` when supported.
- Refresh subscribed podcasts through the worker path.
- On subscription, fetch the podcast immediately and import initial episodes when the RSS document is valid and contains audio enclosures.
- If initial refresh fails after subscription is created, keep the subscription and show a retry/error state.

## Player And Progress

Audio streams directly from the episode enclosure URL.

Player behavior:

- Episode row play button starts playback.
- A persistent mini-player appears at the bottom of the Podcasts surface.
- Mini-player shows episode title, podcast title, progress, play/pause, seek, and open-original.
- Playback progress is saved per user/episode.
- Progress should be persisted periodically while playing and when playback pauses, seeks, or ends.
- If playback reaches near the end, mark the episode played.
- Users can manually mark played or unplayed.

The server should store progress, but the browser should remain responsive if a progress save fails. Failed saves can be retried on the next player event.

## Error Handling

Subscription errors:

- Invalid URL: show a clear URL validation message.
- Not a podcast RSS feed: explain that no audio episodes were found.
- Duplicate subscription: tell the user they are already subscribed.
- Source limit reached: explain the shared 200-source free limit.

Refresh errors:

- Store the last error on the podcast.
- Show a "Needs attention" badge on the show.
- Let the user refresh/retry.

Playback errors:

- Show a concise player error if the audio URL cannot play.
- Keep the "Open original" action available.

## Admin And Directory Management

V1 will seed the curated podcast directory in a structured source file, following the current Discover feed directory pattern. Admin editing for podcast directory entries is deferred.

Directory entries should include:

- Category id.
- Podcast title.
- Feed URL.
- Site URL when known.
- Artwork URL when known.
- Short description.

## Testing

Add focused tests for:

- Podcast RSS discovery and parsing.
- Podcast subscription creation, duplicate checks, and shared source limit.
- Initial episode import from podcast RSS.
- Podcast refresh updates episodes and records errors.
- Podcast home queries only subscribed podcast episodes.
- Playback progress save and played/unplayed state.
- Star and collection actions for podcast episodes.
- Discover Podcasts category/search rendering.
- Existing article feed behavior staying unchanged.

## Rollout Notes

Implementation should be staged:

1. Data model and parser.
2. Podcast subscription and refresh services.
3. Podcasts navigation and home page.
4. Player/progress state.
5. Discover Podcasts.
6. Collection support for podcast episodes.

The release is complete when a new user can open Podcasts, discover or paste a podcast RSS feed, subscribe, see imported episodes, play an episode, leave and return, resume progress, star/save the episode, and open the original episode link.
