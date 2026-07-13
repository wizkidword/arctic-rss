# Canonical origin and proxy runbook

## Scope

SEC-004 prevents request headers from choosing an Arctic RSS URL. The
canonical browser-facing origin is `APP_ORIGIN`; it is parsed at startup and
must be HTTPS in production. Password-reset links, email-verification links,
metadata, aliases, and proxy redirects use this origin rather than `Host`,
`X-Forwarded-Host`, `X-Forwarded-Proto`, or `CF-Visitor`.

Auth.js requires `trustHost: true`. Its `AUTH_URL` remains required and is
validated to exactly match `APP_ORIGIN`, which pins Auth.js request URLs to the
same canonical origin. The Next.js proxy rejects unknown direct Hosts before an
Auth.js route runs.

## Production configuration

Add these non-secret settings to the untracked production `.env` without
displaying the file:

```dotenv
APP_ORIGIN="https://rss.example.com"
APP_ALLOWED_HOSTS=""
AUTH_URL="https://rss.example.com"
```

`APP_ALLOWED_HOSTS` accepts a comma-separated list of reviewed host aliases,
not URLs. Each alias is accepted only to redirect it to `APP_ORIGIN`. Do not
add an alias until its Cloudflare Tunnel public-hostname route has been
reviewed in the Cloudflare dashboard.

`NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` are no longer needed. If a legacy
deployment retains either value, it must match `APP_ORIGIN` exactly; otherwise
the application refuses to start.

## Production traffic path

The production web origin is loopback-bound. A separately managed
Cloudflare connector uses the host network and is the public ingress. The
application cannot safely infer whether a forwarded header was supplied by
Cloudflare, so it does not use forwarding headers for security-sensitive URLs.

Docker uses loopback-only `/api/live` for liveness. The minimal readiness
endpoint at `/api/health` is permitted on loopback and is safe to expose on the
canonical public origin. All other request hosts must match the canonical host
or an explicit alias.

## Deployment and validation

1. Complete the normal backup, clean-source archive, and rollback-directory
   checks in [deployment-rollback-runbook.md](deployment-rollback-runbook.md).
2. Before build, add `APP_ORIGIN` and verify internally that `AUTH_URL` and
   any retained legacy URL variables match it. Do not print their values.
3. Rebuild web and worker. No migration is required.
4. Verify one healthy web container, one healthy worker, local health, public
   health, login, and the Google OAuth callback URL.
5. From the VPS, confirm an invalid direct Host returns `400`, and that
   malicious forwarding headers do not produce an attacker-controlled Location
   header. Use the safe commands in the deployment runbook.

## Rollback

Restore the previous app directory and rebuild it. Keep `APP_ORIGIN` and
`AUTH_URL` set to the reviewed canonical value: they are safe configuration
even when rolling back code. If a legacy release requires the old URL
variables, restore only values that match the canonical origin; never weaken
host validation or use a request-derived origin as a rollback shortcut.
