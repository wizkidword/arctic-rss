# Launch-readiness audit

Severity: P0 blocks basic use or risks data/security. P1 blocks a credible first-time Product Hunt experience. P2 is noticeable but not launch-blocking by itself.

## Reproduced / inspected feedback

| Feedback | Result | Evidence | Status |
| --- | --- | --- | --- |
| Finding and adding a feed | Verified in code and test coverage | Top-level `Add Feed` control and `AddFeedSheet`; authenticated flow still needs release-candidate browser verification with a safe test account. | P1 verification pending |
| Individual feeds visible in navigation | Verified in code/tests | `AppShell` places feed navigation and Discover near the top. | PASS in code |
| Read an individual feed rather than the combined stream | Verified in code/tests | Feed and folder scopes are implemented in `src/lib/articles.ts`; navigation routes are rendered by `AppShell`. | P1 verification pending |
| Article content versus reader UI | Public mobile article smoke showed article text below compact controls; no blocking overlay observed. | Production guest selected article at 390×844. | PASS (smoke) |
| AI competes with article content | Reproduced as resolved | `ArticleAiSummaryPanel` is closed by default; mobile smoke showed “Hidden while reading.” | PASS |
| Slashdot distorted images, duplicate text, broken layout | Partial reproduction / partial resolution | Mobile Slashdot guest smoke had readable text and no image overflow. Parser/reader logic avoids intentionally stacking summary and body. A controlled full-content fixture is still needed before final GO. | P1 verification pending |
| Mobile article reading | Reproduced as resolved in public smoke | 390×844 production inspection rendered article content without clipping or horizontal overflow. | PASS (smoke) |
| Browse individual feeds inside folders | Verified in code/tests | Folder links and scoped article queries exist; release-candidate browser verification remains. | P1 verification pending |
| Clear immediate article removal | Verified in code/tests | Article context menu exposes “Delete article”; user-scoped mutation tests exist. | P1 verification pending |

## Findings

### P1 — duplicate URLs in public guest preview

- **Reproduction:** Visit production `/guest` while the same publisher is present under more than one Discover entry. The current production list showed the same TechCrunch article title/time twice with the same article URL.
- **Cause:** The public preview query collected articles by public feed URL, so the same article could be reached through multiple Discover entries.
- **Fix on this branch:** `listPublicReaderArticlesWithClient` fetches a small bounded buffer, removes duplicate article URLs while preserving the newest occurrence, then applies the requested limit. Regression coverage proves a later unique article fills the result.
- **Verification remaining:** Deploy through the approved process, then run the production guest smoke and confirm no duplicate selected URLs in the visible list. Until then this remains launch-blocking.

### P2 — feed favicon proxy failures

- **Observation:** Public guest browser console reported 502 responses for two Google favicon-proxy requests (`xcancel.com` and `benjamin-bai.com`).
- **Impact:** The reader was still usable and no layout failure was observed; broken favicons reduce visual polish.
- **Action:** Capture exact affected URLs during production smoke, diagnose the proxy/data source separately, and avoid placing a broken-favicon card in final gallery assets.

### Baseline constraints, not product defects

- Local guest routes cannot connect because this workstation has no `DATABASE_URL` and no Docker executable on PATH.
- Node 20.19.0 does not meet the repository’s Node 22+ engine. Run final release checks under Node 22+.

## Verdict

**NO-GO** until the P1 production verification and all human release/account/asset gates are satisfied. No P0 issue was reproduced in the public anonymous flow.
