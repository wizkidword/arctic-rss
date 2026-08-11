# NET-001 trusted-ingress proof package

## Purpose and boundary

This is an owner-run procedure for proving the remaining runtime properties of
the current path:

```text
Browser or Android client -> Cloudflare edge -> managed tunnel -> loopback-bound Compose service
```

It is not a deployment, an ingress-change procedure, or permission to alter
Cloudflare, DNS, the tunnel, firewall, rate limits, or application code. The
historical attempts documented in
[trusted-ingress-verification.md](trusted-ingress-verification.md) were blocked
at the edge before the limiter. Do not repeat their image-proxy request form,
reuse a prior exception, or infer header overwrite from an edge `403`.

## Required fresh approval

Before an operator sends any proof request, record a fresh exact approval that
names all of the following:

- one edge-accepted request method and route;
- whether it is a browser, a dedicated non-production Android account, or a
  controlled command-line client;
- the expected application response and the expected rate-limit observation;
- a one-request-per-case limit and a stop time; and
- confirmation that no provider, DNS, tunnel, firewall, or deployment change
  is part of the proof.

If the method needs an edge exception or configuration change to reach the
origin, stop. That is a materially different action and needs separate owner
approval and its own rollback/revalidation plan. A normal public health check
is not evidence of any forwarding-header property.

Keep the worksheet private. It may contain timestamps, a short opaque probe
label, redacted provider event references, and boolean/count results. It must
not contain an address, user or device ID, email, token, request body, raw
limiter key, secret, or tunnel identifier.

## Read-only preflight

Run these checks before reserving a proof window. Do not make a proof request
if any check is unhealthy or ambiguous.

1. Confirm the canonical public `/api/health` response and login page are
   healthy through the normal public path.
2. From the host, confirm the web/data listeners remain loopback-bound and
   inspect the selected topology with read-only Docker/systemd status commands.
   Record only pass/fail service names.
3. Read the current `NET-001` evidence and confirm the selected route is not
   the already blocked image-proxy form.
4. Capture a private, redacted baseline: the known hashed/keyed observations
   for the controlled real-client IP and the reserved documentation-range
   forged values are absent; aggregate key counts are unchanged. Do not print
   raw Redis values or delete any limiter keys.
5. Ask the provider/operator to identify why this exact method is accepted by
   the edge before sending it. A response that is denied before origin is an
   inconclusive result, not a reason to broaden the probe.

## Proof cases

Use a distinct reserved documentation-range forged value for each header case.
Send no more than the approved single request for a case. Stop immediately on
an unexpected HTTP status, an edge block, a health regression, or any
unexpected key/count observation.

| Case | One approved request | Required redacted observation | Pass condition |
| --- | --- | --- | --- |
| Direct-origin bypass | A private operator-directed connection attempt to the separately inventoried origin address, without public DNS or tunnel changes. | TCP/application result only; no address in the worksheet. | It cannot reach a usable Arctic RSS application response outside the managed public path. |
| User-supplied `CF-Connecting-IP` | The edge-accepted public method with one forged `CF-Connecting-IP` header. | The application-side rate-limit observation changes for the controlled real client, never for the forged value. Provider evidence shows the request reached origin. | Cloudflare overwrote the client-supplied header before the application consumed it. |
| Alternative forwarding header | The same approved method with one forged `X-Forwarded-For` or other alternative header and no forged `CF-Connecting-IP`. | The controlled real-client observation changes; the alternative-header value remains absent. | Alternative forwarding headers do not choose the limiter client IP. |
| Android mobile API | One authenticated, read-only request from a dedicated non-production Android account/device using an existing test session. | The `mobile_api_read` limiter observation is attributed to that controlled real client and does not expose account/device/token data. | The mobile API receives the same trusted client IP boundary. |

The source confirms the relevant actions use `getTrustedClientIp`, including
`public_health`, `mobile_api_read`, and mobile token paths. Runtime evidence
must still show that the public tunnel supplied the trusted value rather than a
caller-controlled header.

## After each case

1. Record only the approved opaque label, UTC time, route class, response
   class, edge-to-origin status, and redacted boolean/count observations.
2. Re-run public health and login. If either fails, stop and use the existing
   incident/recovery procedure; do not keep probing.
3. Let the normal limiter TTL expire. Do not flush Redis, clear limiter keys,
   or alter retention to make the proof cleaner.
4. Update [trusted-ingress-verification.md](trusted-ingress-verification.md)
   with the result. Mark `NET-001` complete only when every case has a direct,
   correlatable pass observation. An edge block, missing key, or ambiguous
   provider event is inconclusive.

## Explicit prohibitions

- No Cloudflare, DNS, tunnel, firewall, or Compose change to make a request
  pass.
- No raw provider exports, tunnel identifiers, host addresses, Redis keys,
  user/device identifiers, tokens, or request payloads in Git or a ticket.
- No repeated requests to force a rate limit and no test against a real user.
- No inference that a running container, public health `200`, or source test
  proves header overwrite.
