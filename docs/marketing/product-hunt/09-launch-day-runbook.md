# Launch-day runbook

This runbook supports a human-operated launch. It does not authorize automated Product Hunt activity, deployment, voting, commenting, or credential use.

## T-24 to T-2 hours

1. Release operator confirms an approved release SHA and executes the existing authorized release procedure only after explicit approval.
2. Run the production smoke checklist in `release-checklist.md` from a logged-out browser.
3. Confirm the canonical direct URL is `https://arcticrss.com` and guest browsing has useful, unique content.
4. Run `npm run ph:assets:validate`; compare the local preview with the manual Product Hunt draft.
5. Confirm thumbnail, gallery, captions, and optional public YouTube playback.
6. Reconfirm pricing, maker account eligibility, no-vote language, and a responder schedule.
7. Record the GO/NO-GO decision and approver in `human-inputs.md` or the release record.

## Launch window

1. Maker launches or schedules manually from their personal account.
2. Maker writes the first comment personally; no generated paste-ready comment is provided by this package.
3. Share only approved, honest external announcements. Ask people to try the product and provide feedback, never for votes.
4. Watch the product surface, direct URL, guest flow, error reports, and feedback themes.
5. Respond personally using `human-response-guide.md`; record actionable reports.

## Incident thresholds

| Symptom | Immediate action |
| --- | --- |
| Homepage or guest route unavailable | Stop promotion; invoke deployment rollback plan; update any affected people honestly. |
| Guest list empty, heavily duplicated, or misleading | Pause outward sharing; rollback/redeploy after diagnosis. |
| Mobile article content blocked/clipped | Treat as a P1; pause promotion and ship/verify a fix. |
| Private data appears in an asset | Remove/replace the asset in the Product Hunt draft; do not publish it. |
| Abuse, vote coordination, or incentive request | Do not participate; remove owned content that violates policy and restate feedback-only intent. |

## T+24 hours

- Export only consented/approved aggregate metrics.
- Categorize feedback and open reproducible issues.
- Do not rush unrelated changes just to affect launch-day ranking.
- Write a brief factual update for the team, then use `10-post-launch-review.md` at seven days.
