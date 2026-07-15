# Arctic RSS Product Hunt launch status

## Current verdict: NO-GO

**Immediate human action:** Create or complete a personal Product Hunt account now. It must represent a real individual and be more than one week old before launch.

This package is prepared on branch `marketing/product-hunt-launch`. It is not a production deployment, Product Hunt submission, scheduled post, or public announcement.

## Gate summary

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Clear public value proposition | PASS | Production home clearly says “Follow the open web without the noise.” |
| Immediate guest trial | PASS | `/guest` works in production with useful public articles and clear guest limits. |
| Mobile article reading | PASS (public smoke) | A 390×844 production check showed readable article content, no image overflow, and a collapsed AI panel. |
| Duplicate guest articles | P1, code fix ready | Production showed an identical TechCrunch URL twice through two Discover entries. A scoped de-duplication fix and regression test are on this branch; deploy and production verification are still required. |
| Local production-like guest test | BLOCKED | No local `DATABASE_URL`; Docker is unavailable from this workstation. |
| Launch assets and demo | BLOCKED BY POLICY | Final assets must not be captured before all launch gates pass and an approved public/demo-data source is selected. |
| Product Hunt maker eligibility | HUMAN BLOCKER | Personal account, real identity/photo, onboarding, and account age are unknown. |
| Release authorization | HUMAN BLOCKER | Deployment is deliberately approval-gated. |

## Phase ledger

| Phase | Status | Deliverable |
| --- | --- | --- |
| 0. Inventory and baseline | COMPLETE | Stack, baseline commands, warnings, and local constraints recorded below. |
| 1. Product truth and readiness audit | COMPLETE | `01-product-truth.md`, `02-launch-readiness-audit.md`. |
| 2. Hardening and regression | IN PROGRESS | Guest preview de-duplication and guest-first CTA are implemented; production verification remains. |
| 3. Positioning, landing, trust, measurement | COMPLETE | `03-positioning.md`; homepage CTA hierarchy updated and tested. |
| 4. Thumbnail and gallery | BLOCKED | Reproducible pipeline prepared, final capture gated. |
| 5. Product demo | BLOCKED | Script, captions, shot list, and upload checklist prepared; video capture gated. |
| 6. Submission copy | COMPLETE | Conservative and fallback copy, community guidance, and maker workbook prepared. |
| 7. Account and submission preparation | PREPARED / HUMAN BLOCKED | Checklists, manifest, and local preview prepared. |
| 8. Release candidate and final QA | IN PROGRESS | Baseline passed; final GO depends on deployment, smoke, assets, and human gates. |
| 9. Launch-day runbook | PREPARED | `09-launch-day-runbook.md`. |
| 10. Post-launch learning | PREPARED | `10-post-launch-review.md`. |

## Baseline recorded on this branch

- `npm install` completed. The workstation runs Node 20.19.0, while this repository requires Node 22 or newer; use Node 22+ for release-candidate work.
- `npm run lint` exited successfully with two pre-existing unused-argument warnings in `src/app/app/actions.ts` (lines 838–839).
- `npm run typecheck`, `npm test` (817 tests), `npm run test:e2e` (2 tests), and `npm run build` passed after the launch changes.
- `npm start` is not the standalone production command for this project, and production configuration correctly rejects a missing `APP_ORIGIN`. This is a documented local-environment limitation, not a bypass target.
- Public production smoke checks covered `/`, `/guest`, and a selected `/guest?articleId=...` article at desktop and mobile widths.

## Decisions

- Public messaging says **browser-based**, not native/mobile app.
- AI summaries are optional supporting tools; they are not the headline claim.
- Arctic IRC/chat is excluded from Product Hunt positioning and assets.
- Final Product Hunt screenshots, thumbnails, and video are intentionally absent until the P1 fix is live and verified.
- Product Hunt and all social/community activity remain human-operated. No votes, comments, scheduling, submission, or account activity is automated.

## Current execution evidence

- Focused launch regression: `npm run ph:test` — 3 files / 20 tests passed.
- Full application regression: `npm test` — 186 files / 817 tests passed.
- Public end-to-end smoke: `npm run test:e2e` — 2 tests passed.
- Static checks: `npm run typecheck`, `npm run lint`, and `npm run build` passed. Lint retains the two documented existing unused-argument warnings.
- Security-oriented dependency check: `npm audit --omit=dev` found 0 vulnerabilities.
- Public launch smoke: `npm run ph:smoke` returned 200 for `/`, `/guest`, `/guest/discover`, `/guest/podcasts/discover`, and `/api/health`.
- Gate behavior: `npm run ph:assets:validate`, `npm run ph:demo`, and strict `npm run ph:package` correctly stop before final captures/launch because approval and final assets are absent.
