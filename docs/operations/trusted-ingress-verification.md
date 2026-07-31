# Trusted ingress verification

**Reconciled:** 2026-07-30, after approved managed-tunnel recovery and one
controlled header-proof attempt.
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
- One approved runtime header attempt used a reserved documentation-range
  client-IP value and a loopback image URL. It returned HTTP 403 rather than
  the application's expected invalid-image response. Before and after the
  request, the forged-IP hashed limiter key was absent and the aggregate count
  of anonymous image-proxy limiter keys was zero. The request therefore did
  not reach the application limiter; no retry was sent.

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
is still open because the one approved image-proxy request was blocked before
the limiter. Do not retry broadly or infer header behavior from that 403. A
future proof needs fresh approval for one edge-accepted request form that can
demonstrably reach the limiter, followed by the same redacted hashed-key
existence/count check.

This is an evidence task, not authorization to change the tunnel, DNS,
firewall, or application deployment.
