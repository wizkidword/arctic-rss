# Gallery storyboard

No final gallery image is created until the P1 duplicate-preview fix is deployed and the release candidate passes the public smoke checks. The final format is 1270×760 PNG, with four to six images selected only from public or purpose-built demo data.

| Order | Filename | Message | Required proof before capture |
| ---: | --- | --- | --- |
| 1 | `gallery/01-calm-open-web.png` | Follow the open web without the noise. | Homepage value prop and Guest CTA visible; no unsupported claims. |
| 2 | `gallery/02-browse-without-account.png` | Browse public sources before creating an account. | Guest list has useful, unique articles and clear guest limitations. |
| 3 | `gallery/03-discover-your-sources.png` | Discover feeds and podcasts by topic. | Discover route works with current public/demo data. |
| 4 | `gallery/04-read-your-way.png` | Choose a reading layout that suits the moment. | Layout switcher and article rendering work at desktop and mobile widths. |
| 5 | `gallery/05-build-a-reading-space.png` | Follow, save, organize, and import OPML after account creation. | Authenticated demo account with only synthetic/public data; no private feed names. |
| 6 (optional) | `gallery/06-optional-ai-summaries.png` | Optional on-demand summaries, kept out of the way while reading. | AI is configured and panel behavior verified; otherwise omit this image. |

## Art direction and capture rules

- Use real UI at 1270×760, not a fabricated product mockup.
- Maintain readable type, one key point per image, and high contrast.
- Crop only browser chrome, never hide a limitation that changes the product story.
- Do not show account identity, email addresses, personal feeds, private articles, API keys, or sensitive reading history.
- Do not claim native apps, chat, a roadmap feature, ranking, or a Product Hunt endorsement.
- Use neutral annotations only where they clarify a real UI feature.

## Supporting assets

- `thumbnail/arctic-rss-product-hunt.png`: 240×240, under 3 MB, recognizable brand mark, no tiny copy.
- `social/arctic-rss-open-graph.png`: 1200×630 for owned social channels only.
- `contact-sheet.html`: review surface generated after the final assets exist.
- `preview.html`: Product Hunt-style local review page using copy and asset status.

The asset pipeline owns dimensions, checksums, and filename order in `asset-manifest.json`.
