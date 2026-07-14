# Arctic IRC threat model

## Assets and trust boundaries

Protected assets include Arctic account sessions, connection tokens, chat handles and membership, native message history, reports/audit evidence, private feed subscriptions, Redis rate-limit/presence data, PostgreSQL data, and any future external IRC credentials.

Trust boundaries are: browser to Next.js, browser to the future gateway, gateway to PostgreSQL/Redis, worker jobs, the Cloudflare/public connector, and (later) the connector to an allowlisted third-party IRC network. External IRC is never trusted as an Arctic identity or content source.

## Required mitigations

| Threat | Required control | Phase |
| --- | --- | --- |
| Stored/reflected XSS in handles, topics, messages, or article metadata | Zod validation, length limits, React text rendering only, no chat `dangerouslySetInnerHTML`, and safe article references | 1–4, 8 |
| Stale, forged, or replayed gateway token | Short TTL signed token, memory-only client use, token ID replay record in Redis, `authVersion`/disabled check, redacted logs | 2 |
| Cross-room history or socket leakage | Server-authoritative membership checks for every REST/socket operation; integration tests with isolated users/rooms | 3 |
| Privilege escalation | Central typed global/room permission service; UI is never authorization; append-only audit data | 1, 9 |
| Chat spam, floods, or reconnect storms | Redis account/IP/room rate limits, quotas, bounded queues, slow mode, exponential backoff, metrics | 2–3, 9 |
| Exposure of private subscriptions | Derive recommendation signals server-side only; never return raw subscriptions, log them, or send them to IRC networks | 1, 6 |
| SSRF through previews | Initially omit generic previews; if enabled, use a dedicated worker with DNS/IP/redirect/content-size validation | 8, 11 |
| Malicious external IRC server or credentials | Allowlisted endpoints only, TLS verification, capability-aware parser, secret redaction, no browser persistence, per-network kill switch | 7 |
| External IRC identity confusion | Strong native/external labels, separate data models and authorization paths, no bridging or transcript archive | 7 |
| Moderator misuse or incomplete evidence | Restricted, append-only audit rows; role checks; documented retention and review access | 9, 11 |
| Sensitive logs | Continue current structured, body-free logging; never log tokens, cookies, passwords, emails, message bodies, subscription lists, or report details without a documented narrow exception | all |

## Repository-specific observations

`src/proxy.ts` already validates host headers and canonicalizes the origin. `next.config.ts` provides a report-only CSP whose `connect-src` currently permits only same-origin and Google Analytics endpoints. Before WSS release, add the exact gateway origin/path after the final routing topology is known; do not use a wildcard.

`src/lib/rate-limit.ts` fails closed when Redis is unavailable and hashes rate-limit subjects. Native chat should keep those properties. `User.disabledAt` and `authVersion` already provide account-disable/session-revocation primitives, but chat-specific sanctions do not yet exist.

## Residual risks requiring product decisions

- Retention, deletion/anonymization, and access policy for messages, reports, and audit records must be approved before beta.
- Moderation coverage and staff response capability must be ready before public posting.
- An external IRC bouncer changes network-facing accountability. Production use requires a reviewed network/operator policy record and no arbitrary outbound destination.
