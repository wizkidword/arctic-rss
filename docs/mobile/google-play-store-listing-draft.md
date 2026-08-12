# Google Play store listing draft

**Status:** pre-identity working draft. It is not in Play Console, is not a
submission, and requires owner review against the exact signed AAB and current
Play Console requirements.

This draft intentionally describes only the Android alpha that exists today.
It does not claim native podcast playback, listening-progress controls, push
delivery, full-library offline sync, OPML management, administrative tools, or
features that remain web-only.

## Proposed English (United States) listing

| Field | Draft | Check |
| --- | --- | --- |
| App name | `Arctic RSS` | 10 characters; matches the app configuration. |
| Short description | `A calm reader for your feeds, articles, saved reading, and briefings.` | 68 characters; beneath the current 80-character limit. |
| App category | News & Magazines | Owner to confirm in Play Console. |
| Privacy policy | `https://arcticrss.com/privacy` | Public endpoint returned HTTP 200 during the pre-identity review on 2026-08-11; recheck signed out before publication. |
| Account deletion | `https://arcticrss.com/delete-account` | Public endpoint returned HTTP 200 during the pre-identity review on 2026-08-11; recheck signed out before publication. |
| Support contact | Not supplied | Owner must provide a support email and any chosen website/contact details in Play Console. |

### Full description

Arctic RSS is a calm reader for people who want a clearer view of their feeds.

Sign in with your existing Arctic RSS account to read All, Unread, and Starred
articles, explore saved views, and search your library. Open an article, star
or archive it, and save it to a collection for later.

Review Smart Digest briefings and your subscribed podcast episodes. Add notes,
mark episodes complete, and star them. Native audio playback and
listening-progress controls are not included.

Arctic RSS keeps recently requested reader data on your device for a bounded
offline view. Eligible small changes can wait safely for a connection to return.
Account and support tasks continue on Arctic RSS on the web.

## Asset handoff

| Asset | Current state | Remaining work |
| --- | --- | --- |
| Store icon | `public/brand/arctic-rss-play-icon.png` is a 512 x 512, 32-bit RGBA PNG, 230,720 bytes. It preserves the original icon's RGB pixels. | Confirm the rendered icon meets Play's current graphic-content rules before upload. |
| Feature graphic | Not present. | Create a current, reviewed graphic after the signed build can be exercised. |
| Phone screenshots | Not present. | Capture from the exact signed candidate using non-sensitive, disposable test data: reader, article, collection, briefing, and episode-state screens. Do not show account identity, tokens, feed URLs, or private article content. |
| Tablet / Chromebook screenshots | Not present. | Decide whether the app will be distributed to large-screen devices, then follow the current Play Console asset requirements. |
| Promotional video | Not planned. | Optional; do not create a video that implies unavailable features. |

## Owner-only console fields

The identity-verification gate prevents completing or submitting the following:

- developer identity/profile and any support contact information;
- app-access instructions and test credentials, if Play review requires them;
- content-rating questionnaire, Data safety declaration, and data-deletion
  declaration;
- internal tester group, track creation, AAB upload, release notes, and rollout;
- the final signing-owner record and Android App Links association.

Use the current Play Console character counters and asset validator as the
final authority. Google requires accurate listing text and assets that match
the app's current behavior; this document is a reviewable starting point, not
a publication approval.
