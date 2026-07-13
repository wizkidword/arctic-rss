# Rate limiting and Turnstile runbook

## What this protects

The application uses Redis-backed, atomic counters for login, signup, password
reset requests and completions, verification-email resend, feed discovery and
manual refresh, OPML imports, feedback submissions, AI summaries, AI digests,
and administrator Discover OPML imports. Credential login also covers the
administrator sign-in path.

Counters use a bounded TTL and hash their identifier before it reaches Redis.
They never contain an email address, IP address, password, or token in clear
text. When Redis is unavailable or full, protected actions fail closed with a
generic retry message and a structured security log that contains only the
action, limiter scope, and outcome.

The limits are intentionally scoped by account, user, client IP, or a combined
account-and-IP key where appropriate. The longest window is 24 hours; no user
is permanently locked out by a limiter key.

## Redis safety policy

Redis is loopback-bound on the VPS and is not publicly exposed. The Compose
configuration sets a 256 MB ceiling with `noeviction`. Queue jobs therefore
cannot be evicted by high-volume limiter keys. If the ceiling is reached,
protected actions fail closed and the deployment should be investigated rather
than changing the eviction policy casually.

Inspect this safely on the VPS without printing runtime secrets:

```bash
cd /opt/arctic-rss/app
docker compose exec -T redis redis-cli INFO memory | grep -E '^(used_memory_human|maxmemory_human):'
docker compose exec -T redis redis-cli CONFIG GET maxmemory maxmemory-policy
```

Do not use a volatile-LRU or allkeys-LRU policy while worker queues and limiter
keys share this Redis instance.

## Client IP source

Only Cloudflare's `CF-Connecting-IP` header is used for IP-scoped limits;
`X-Forwarded-For` is ignored. The tunnel remains the only public path to the
loopback-bound web container. If the routing architecture changes, verify that
Cloudflare still supplies this header before relying on IP-based policy.

## Enabling Turnstile in production

Turnstile is currently optional so a missing configuration cannot break an
existing deployment. After creating a Cloudflare Turnstile widget restricted to
the canonical `APP_ORIGIN` hostname:

1. Set the public site key and secret key in the VPS `.env` without copying
   their values into a terminal transcript, ticket, or repository.
2. Set `TURNSTILE_REQUIRED=true` in the same `.env` only after both keys are
   present.
3. Rebuild the web service using the normal deployment runbook.
4. Confirm login, signup, and password-reset request forms render the widget
   and accept a fresh challenge.

Production startup refuses to serve when `TURNSTILE_REQUIRED=true` but either
key is absent. Successful Siteverify responses must contain the exact expected
action and canonical hostname. The request has a five-second outbound timeout,
includes the trusted Cloudflare client IP when available, and rejects any
reported Turnstile error code.

## Deployment verification

After deployment, verify the containers and both health paths. Then use a
non-production test account to submit an intentionally repeated protected
action until the generic retry response appears. Wait for that action's
documented window before treating the account as available again. Never test by
printing or sharing reset tokens, passwords, or production environment values.
