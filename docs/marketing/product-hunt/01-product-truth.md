# Verified product truth

This document separates release-safe claims from internal capabilities. Routes below are public unless stated otherwise.

| Claim | Status | Evidence |
| --- | --- | --- |
| Arctic RSS is a browser-based reader | VERIFIED | Public landing route `src/app/page.tsx`; production `https://arcticrss.com/`. |
| A visitor can browse before creating an account | VERIFIED | `src/app/page.tsx` links to `/guest`; production `/guest` rendered 50 public articles and stated its limits. |
| The product helps readers choose sources instead of an algorithmic feed | VERIFIED AS POSITIONING | Landing copy and source subscription/Discover design support this product statement; do not make a comparative performance claim. |
| Discover supports public feed and podcast browsing | VERIFIED | `src/components/app-shell.tsx` exposes Discover Feeds and Discover Podcasts; guest routes exist at `/guest/discover` and `/guest/podcasts/discover`. |
| Multiple reader layouts exist | VERIFIED | Production guest reader exposed Classic, Card, Compact, and River layouts. |
| Signed-in readers can add feeds and organize folders | VERIFIED | `src/components/add-feed-sheet.tsx` and `src/components/app-shell.tsx`; this is account-only, not a guest claim. |
| OPML import/export exists | VERIFIED FOR AUTHENTICATED READER | Reader/admin queue and tests reference OPML import; keep this as an authenticated feature claim. |
| Articles can be saved, starred, marked read, and deleted | VERIFIED FOR AUTHENTICATED READER | `src/components/article-context-menu.tsx` and its tests expose the actions. Do not imply these controls work in guest mode. |
| Optional on-demand AI summaries exist | VERIFIED FOR AUTHENTICATED READER | `src/components/article-ai-summary-panel.tsx`; panel is a closed `<details>` control by default and guest mode explains AI tools require an account. |
| Optional analytics is consent-respecting | VERIFIED IN CODE | The live home route exposes privacy choices and analytics is designed around local affirmative consent. Do not promise a stronger privacy posture than the policy states. |
| Email and optional Google authentication exist | VERIFIED IN CODE | Authentication configuration supports local credentials and optional Google provider configuration. Do not state Google sign-in is available in production without a live configuration check. |

## Excluded from launch claims

- Native iOS, iPadOS, macOS, Android, or desktop applications.
- Arctic IRC/chat, beta-only capabilities, roadmap items, or unfinished flags.
- Any claim that every RSS publisher exposes a full article body.
- “Open source” (no current license claim has been verified for the Product Hunt page).
- A specific pricing model until a human confirms it.

## Content-rendering evidence

- Feed parsing prioritizes full article content where feeds supply it (`src/lib/feed-articles.ts`), while the reader renders a selected content body rather than stacking a summary and full body as the same article text (`src/components/reader-surface.tsx`).
- Reader-content sanitization is covered by `src/lib/articles.test.ts`.
- Mobile production smoke of a Slashdot article at 390×844 showed readable text and no distorted image in the inspected article.

## Claim guard

Use only the concise, public statements in `04-submission-copy.md` until a release candidate has passed the remaining gates in `00-status.md`.
