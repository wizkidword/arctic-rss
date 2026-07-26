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

Both Redis containers are loopback-bound on the VPS and are not publicly
exposed. Their workloads are intentionally separate:

- `redis` is durable: it stores BullMQ queues and scheduled-job state on the
  `redis-data` volume, uses AOF, has a 256 MB ceiling, and uses `noeviction`.
  A full durable store must fail safely rather than discard jobs.
- `redis-ephemeral` is disposable: it stores only Socket.IO pub/sub, presence,
  replay protection, rate-limit keys, and security-event fan-out. It has no
  volume, a separate 128 MB ceiling, and `volatile-ttl`; every application key
  written there must have a bounded TTL.

The transactional chat outbox remains in PostgreSQL, so losing the ephemeral
publisher transport cannot lose the durable event record. A gateway or web
restart reconnects and reauthorizes against the authoritative database state.

Inspect this safely on the VPS without printing runtime secrets:

```bash
cd /opt/arctic-rss/app
docker compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO memory | grep -E "^(used_memory_human|maxmemory_human|mem_fragmentation_ratio):"'
docker compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" CONFIG GET appendonly maxmemory maxmemory-policy'
docker compose exec -T redis-ephemeral sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO memory | grep -E "^(used_memory_human|maxmemory_human|mem_fragmentation_ratio):"'
docker compose exec -T redis-ephemeral sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" CONFIG GET appendonly maxmemory maxmemory-policy'
```

The production monitor checks both containers, durable AOF health, configured
policies, fragmentation, and increasing Redis command-error, OOM, and rejected
connection counters. Treat an alert as a capacity incident: identify the
workload first, preserve durable queue data, and do not move any BullMQ queue
to `redis-ephemeral` to silence it.

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
