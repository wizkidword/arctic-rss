# Today composition decision

## Decision

Do not add a separate **Today** destination in this pass.

## Evidence reviewed

- The main reader already presents the current unread stream at `/app`.
- `/app/ai` already has a bounded “Today’s briefing candidates” composition of
  recent unread articles from active subscriptions, plus existing daily and
  weekly briefing generation.
- Saved views, story coverage, podcasts, and Smart Digests keep their current
  routes and data models. Combining them would need a new cross-domain query
  surface and another navigation destination before there is usage evidence
  that it would simplify the reader.

## Recommendation

Keep `/app` as the immediate reading surface and improve the existing
`/app/ai` briefing composition when evidence supports it. Revisit a unified
Today view only if it can replace an existing landing surface, reuse the
current reader and digest queries, and does not require a new worker family,
database domain, top-level navigation item, or material additional AI cost.

This is a local product decision record, not production-usage evidence.
