# Trusted ingress verification

**Reconciled:** 2026-07-30, after approved managed-tunnel recovery and three
controlled header-proof attempts.
**Scope:** `NET-001` OVH trusted-ingress verification. This record separates
the historical relay evidence from the current managed-tunnel path and records
only redacted operational results.

## Current evidence

- The canonical public health endpoint returned HTTP 200 after the approved
  managed-tunnel and proxied DNS switch.
- The current managed tunnel has one healthy connector in the OVH application
  Compose environment. Its configured origin reaches the Compose web service;
  an in-network health request returned the expected healthy response. This
  maps the **current** managed-tunnel origin to the intended OVH application
  host without recording a host address, tunnel identifier, or resolver value.
- The application web, worker, PostgreSQL, and durable/ephemeral Redis services
  are healthy. Application/data listeners remain non-public.
- The historical separate-relay helper result remains valid only as historical
  evidence. It is not used to describe the current public route after the
  managed-tunnel switch.
- Provider DNS inventory found no DNS-only web-capable bypass candidate; the
  current web path is proxied.
- Source and tests confirm that security-sensitive URL construction ignores
  forwarding headers, and the rate limiter accepts only `CF-Connecting-IP`,
  not `X-Forwarded-For`.
- Two separately approved, single runtime header attempts used the same
  reserved documentation-range client-IP value but distinct image URL forms:
  first a loopback URL, then an edge-acceptable public non-image URL. Each
  returned HTTP 403 rather than the application's expected response. Before
  and after each request, the forged-IP hashed limiter key was absent and the
  aggregate count of anonymous image-proxy limiter keys was zero. Neither
  request reached the application limiter. A read-only provider Security
  Events inspection, filtered to edge-status 403, showed two `Block` / Managed
  Rules events among four sampled events in the current 24-hour window. The
  probes did not retain an event identifier, so the records cannot be uniquely
  correlated to either request; they support an edge-side block classification
  but do not identify the trigger or prove header overwrite.
- One later approved, one-use provider WAF exception matched only a unique
  image-route query marker and skipped only Managed Rules. Its redacted
  pre-check was zero for both measures above; the single forged-header request
  still returned HTTP 403, and the post-check remained zero for both measures.
  The exception was deleted immediately and its absence was verified. This
  attempt establishes only that the request was still blocked before the
  limiter despite that narrowly scoped Managed-Rules skip; it neither
  identifies the responsible edge control nor proves header overwrite.
- A subsequent read-only provider settings review found Bot Fight Mode disabled
  and Browser Integrity Check enabled. The retained event sample cannot
  uniquely link Browser Integrity Check to the earlier requests, so this is a
  plausible remaining edge gate rather than a causal conclusion. Its documented
  block-before-origin behavior explains why a Managed-Rules-only skip was not a
  sufficient proof path.

## Current classification

`NET-001` remains **incomplete**. The established portion is:

```text
Browser -> Cloudflare edge -> managed Cloudflare Tunnel -> verified OVH application connector -> Compose web service
```

The current managed-tunnel origin is mapped to the intended application host,
and the provider DNS inventory does not expose a web bypass candidate. The
remaining gap is runtime proof that Cloudflare overwrites `CF-Connecting-IP`.

## Required closure before claiming an exact packet path

The origin mapping is complete for the current managed route. The header proof
is still open because all three approved image-proxy requests were blocked
before the limiter, including one made while a one-use Managed-Rules skip was
active. Do not infer header overwrite from the HTTP 403 results or retry
broadly. The next candidate needs fresh approval for a materially different,
edge-accepted method: a one-use, exact-query provider configuration exception
that disables Browser Integrity Check only for the single probe, followed by
immediate deletion and the same redacted hashed-key existence/count check. Do
not create that exception without explicit provider-change approval.

This is an evidence task, not authorization to change the tunnel, DNS,
firewall, or application deployment.
