# Outbound URL Fetch Security Runbook

## Purpose

Arctic RSS retrieves user-supplied feed and article URLs. Those requests are a security boundary: an untrusted URL must not gain access to local services, private networks, cloud metadata, or Docker/host management endpoints.

## Application controls

`src/lib/url-safety.ts` is the required transport layer for user-controlled outbound text fetches.

- Only `http` and `https` URLs on their standard ports are accepted.
- Embedded credentials, local hostnames, loopback, private, link-local, multicast, documentation, and reserved IP ranges are rejected.
- IPv4-mapped IPv6 values are normalized and checked against the same IPv4 policy.
- Every DNS result must be public. One unsafe result rejects the hostname.
- The selected validated address is pinned into Undici's connection lookup. The original hostname remains the HTTP host, TLS SNI value, and certificate-validation name.
- Each redirect is normalized, resolved, and pinned again.
- One fetch has a 10-second hop timeout, 15-second total deadline, five redirect limit, and bounded response body. Callers can set a smaller response-body limit where needed.
- A process-wide limiter allows at most four in-flight safe fetches per hostname.
- Feed and podcast refreshes reuse validated `ETag` and `Last-Modified` values as conditional request headers. A `304 Not Modified` response is a successful refresh with no response body or item parsing.

Current callers include feed refresh, Hacker News linked-article extraction, feed discovery, podcast subscriptions and refresh, and discover-directory OPML verification. The only remaining direct `fetch` calls are fixed provider endpoints for OpenAI and Turnstile verification; they do not accept user-controlled URLs.

## Request budgets

- Feed discovery makes no more than 12 outbound fetches for one discovery attempt.
- A feed refresh makes at most 13 upstream requests: one feed request plus up to 12 Hacker News linked-article requests. Linked-article requests run with local concurrency of three and still share the per-host limit.
- Podcast feeds retain their separate 8 MiB body limit; ordinary feeds and discovery verification use 2 MiB.
- Parsed feed articles and podcast episodes are written in batches of at most 100. New records use bulk insertion; existing records are updated in bounded transaction batches.
- The worker writes structured `source_refresh` logs for successful and failed refreshes. Successful events include request bytes, duration, parsed, inserted, updated, skipped, and conditional-hit counts.

## Operational verification

Before releasing changes to this layer, run:

```powershell
npm test -- --run src/lib/url-safety.test.ts src/lib/feed-discovery.test.ts src/lib/feed-refresh.test.ts src/lib/podcast-refresh.test.ts src/lib/refresh-write-batch.test.ts
npm run typecheck
npm run build
```

Confirm at least these behaviors in the tests:

- Internal IPv4, IPv6, and hexadecimal IPv4-mapped IPv6 destinations are rejected.
- A mixed public/private DNS answer is rejected.
- A redirect to an internal destination is rejected.
- The custom lookup receives the validated address, not a fresh DNS result.
- Redirect and per-job request budgets stop further work.
- Conditional responses do not parse or write items, and header values containing line breaks are never forwarded.

## VPS egress restrictions: inventory first

Application-level controls are deployed independently from host firewall changes. Do **not** add Docker `DOCKER-USER`, host firewall, provider firewall, or egress-proxy rules until the production dependencies below have been verified from the VPS and a working console rollback path is available.

Required outbound categories to inventory:

- DNS resolution
- HTTP/HTTPS feed and article origins
- SMTP delivery
- OpenAI API access
- OAuth provider endpoints
- Cloudflare Turnstile verification
- Image and package registries during image builds only

After that inventory, restrict app and worker egress in a reversible change set. At minimum, block host loopback, Docker bridge management networks, private LAN ranges not required by the app, cloud metadata addresses, and provider/control-plane internal endpoints. Preserve database and Redis access only for containers that require them.

## Rollback

For an application rollback, deploy the preceding known-good release using `docs/operations/deployment-rollback-runbook.md`. Do not remove network rules as part of an application rollback unless those rules were deployed in the same change set and the console rollback path has been verified.
