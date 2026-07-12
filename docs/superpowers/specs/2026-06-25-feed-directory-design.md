# Feed Directory Design

## Goal

Add an in-app directory that helps readers discover and subscribe to curated
RSS feeds without needing to know a feed URL. The first category is **US
General**, and the design must support adding future categories through catalog
data rather than new page logic.

## Entry Point

Add a **Discover Feeds** link directly below **Add Feed** in the Feeds section
of the desktop and mobile reader navigation. The link uses a compass icon and
opens:

```text
/app/discover
```

The existing Add Feed workflow remains available for readers who already know
the URL they want.

## Directory Experience

The directory is a quiet, scan-friendly reader tool rather than a marketing
page. It contains:

- A page heading and short description.
- A category selector or rail that starts with **US General**.
- A subscription count for the selected category.
- One compact row per feed.
- A friendly feed name.
- The publisher or source domain.
- A **Subscribe** command for feeds the reader has not added.
- A disabled **Subscribed** state for feeds already in the reader.
- Inline pending, success, and error feedback scoped to the selected feed.

Multiple feeds from one publisher remain separate entries when they represent
different editorial streams. Examples include NBC Top Stories and NBC World,
NPR National and NPR World, and Los Angeles Times Nation and World.

## Subscription Workflow

Selecting **Subscribe** opens a compact folder picker for that feed.

The picker:

- Names the selected feed.
- Defaults to **Uncategorized**.
- Lists the signed-in reader's folders.
- Has Cancel and Subscribe commands.
- Disables submission while the request is pending.
- Keeps recoverable errors visible so the reader can retry.

On success:

- The picker closes.
- The row changes to **Subscribed**.
- The reader shell refreshes so the new feed appears immediately.
- The subscription is assigned to the selected folder, or remains
  Uncategorized.
- Initial article refresh follows the existing Add Feed behavior.

## Catalog Architecture

The first version uses a typed, version-controlled TypeScript catalog.

The catalog contains:

- Stable category IDs.
- Stable feed IDs.
- Display labels.
- Verified feed URLs.
- Source domains.
- Category membership.
- Explicit display order.

The directory page, category selector, and subscribe controls render from this
catalog. Adding a future category requires catalog records only; routing and
subscription logic do not change.

Catalog validation enforces:

- Unique category IDs.
- Unique feed IDs.
- Unique canonical feed URLs.
- Valid HTTP or HTTPS URLs.
- Valid category references.
- Non-empty display labels and source domains.

The catalog can later move to database-backed administration without changing
the page or subscribe-control interfaces.

## Initial Category

Category:

```text
ID: us-general
Label: US General
```

### Verified Launch Feeds

The following 27 feeds passed live discovery and RSS/Atom parsing with Arctic
RSS on June 25, 2026.

| Display Name | Verified Feed URL |
| --- | --- |
| ABC News - U.S. | `https://abcnews.com/abcnews/usheadlines` |
| CNN Top Stories | `http://rss.cnn.com/rss/cnn_topstories.rss` |
| CBS News - Latest | `https://www.cbsnews.com/latest/rss/main` |
| New York Times - U.S. | `https://rss.nytimes.com/services/xml/rss/nyt/US.xml` |
| Wall Street Journal - U.S. News | `https://feeds.content.dowjones.io/public/rss/RSSUSnews` |
| Christian Science Monitor - USA | `https://rss.csmonitor.com/feeds/usa` |
| NBC News - Top Stories | `https://feeds.nbcnews.com/nbcnews/public/news` |
| NBC News - World | `https://feeds.nbcnews.com/nbcnews/public/world` |
| BBC News - U.S. & Canada | `https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml` |
| Yahoo News - U.S. | `https://news.yahoo.com/rss/us` |
| Yahoo News - World | `https://news.yahoo.com/rss/world` |
| The Daily Beast - Latest | `https://feeds.feedburner.com/thedailybeast/articles` |
| Quartz | `https://qz.com/rss` |
| The Guardian - U.S. News | `https://www.theguardian.com/us-news/rss` |
| Politico - Politics | `https://rss.politico.com/politics-news.xml` |
| The New Yorker - News | `https://www.newyorker.com/feed/news` |
| PBS NewsHour - Nation | `https://feeds.feedburner.com/NationPBSNewsHour` |
| PBS NewsHour - World | `https://feeds.feedburner.com/NewshourWorld` |
| NPR - National | `https://feeds.npr.org/1003/rss.xml` |
| NPR - World | `https://feeds.npr.org/1004/rss.xml` |
| The Atlantic - U.S. | `https://feeds.feedburner.com/AtlanticNational` |
| Los Angeles Times - Nation | `https://www.latimes.com/nation/rss2.0.xml` |
| Los Angeles Times - World | `https://www.latimes.com/world/rss2.0.xml` |
| Talking Points Memo | `https://talkingpointsmemo.com/feed` |
| Salon - News | `https://www.salon.com/category/news/feed` |
| TIME | `https://time.com/newsfeed/feed/` |
| Fox News - Latest | `https://moxie.foxnews.com/google-publisher/latest.xml?format=xml` |

## Omitted Legacy Sources

The following 12 supplied entries are intentionally excluded from the launch
catalog. They were dead, redirected to unrelated content, or lacked a
trustworthy official RSS successor during verification.

| Supplied Source | Reason Omitted |
| --- | --- |
| USA Today News | Legacy URL redirects to a USA Today advertising feed, not newsroom content. |
| Reuters World News | Legacy feed hostname no longer resolves; no official replacement RSS feed was found. |
| Reuters Domestic News | Legacy feed hostname no longer resolves; no official replacement RSS feed was found. |
| Associated Press U.S. Headlines | Legacy hosted AP hostname no longer resolves; AP's current site exposes no verified official RSS successor. |
| Associated Press World Headlines | Legacy hosted AP hostname no longer resolves; AP's current site exposes no verified official RSS successor. |
| HuffPost World | Legacy feed returns 404; no verified official successor was found. |
| Newsweek | Legacy RSS endpoint returns 404; no verified official successor was found. |
| U.S. News | The supplied endpoint could not be validated reliably. |
| The Atlantic Wire | The legacy FeedBurner address now resolves to an unrelated music feed and must never be cataloged. |
| BreakingNews.com | Legacy API hostname no longer resolves. |
| Vice News | Legacy news hostname no longer resolves. |
| Mashable U.S. & World | Legacy endpoint returns 404; no readable official replacement passed Arctic RSS validation. |

These omissions are recorded so contributors can revisit them if publishers
restore official RSS support.

## Subscription State Matching

The directory must recognize existing subscriptions even when an older URL
redirected to the catalog's verified canonical URL.

The page receives the user's active subscriptions and compares their stored
feed URLs against catalog URLs after normalization. Each catalog entry is
therefore either:

- Available to subscribe.
- Pending subscription.
- Subscribed.
- Failed with a readable inline message.

Duplicate subscriptions continue to be blocked by the existing user/feed
uniqueness constraint.

## Server Action

Add a dedicated catalog subscription Server Action.

The action:

1. Requires an authenticated user.
2. Accepts a stable catalog feed ID and optional folder ID.
3. Rejects unknown or modified catalog IDs.
4. Confirms that a selected folder belongs to the authenticated user.
5. Resolves the feed URL from the server-owned catalog.
6. Reuses the existing safe feed discovery and subscription service.
7. Attempts the existing initial article refresh.
8. Revalidates the directory and reader shell paths.
9. Returns structured success or readable error state.

The client never submits an arbitrary feed URL through the directory action.
Manual arbitrary URLs remain the responsibility of the existing Add Feed
workflow.

## Error Handling

- Anonymous requests receive a sign-in error.
- Unknown catalog feed IDs receive a safe unavailable-feed error.
- Missing or foreign folder IDs receive a safe folder error.
- Duplicate subscriptions display the existing already-subscribed message.
- Feed discovery, unsafe URL, and fetch failures display readable errors beside
  the selected feed.
- An initial article-refresh failure does not undo a successful subscription;
  the worker can retry later.
- One failed feed does not affect other directory rows.

## Testing

### Catalog Tests

- Category and feed IDs are unique.
- Canonical feed URLs are unique.
- Every feed references a real category.
- Every launch URL is valid HTTP or HTTPS.
- US General contains the expected 27 entries in stable order.
- The hijacked Atlantic Wire URL is absent.

### Server Action Tests

- Authentication is required.
- Unknown catalog IDs are rejected.
- Uncategorized is the default.
- Owned folders are accepted.
- Foreign folders are rejected.
- Successful subscriptions call the existing service with the catalog URL.
- Duplicate and discovery errors remain readable.
- Successful subscription triggers directory and reader revalidation.

### Component And Page Tests

- Desktop and mobile navigation render **Discover Feeds**.
- The US General category and all expected rows render.
- The folder picker defaults to Uncategorized.
- Reader folders appear in the picker.
- Pending controls are disabled.
- Already-added feeds render Subscribed.
- Inline success and error feedback is feed-specific.

### Browser QA

Use an isolated reader account with a temporary folder:

1. Open Discover Feeds from the sidebar.
2. Confirm the US General category and feed rows render.
3. Subscribe to one feed as Uncategorized.
4. Confirm it appears in the reader sidebar and row becomes Subscribed.
5. Subscribe to another feed into the temporary folder.
6. Confirm it appears under that folder.
7. Confirm duplicate subscription is not offered.
8. Confirm no relevant browser console errors.
9. Remove all QA records.

## Out Of Scope

- Admin catalog editing.
- Reader-submitted directory listings.
- Ratings, popularity, recommendations, or personalization.
- Bulk category subscription.
- Searching across categories.
- Automated replacement of dead catalog feeds.
- Third-party or generated RSS feeds when a publisher has no official feed.
