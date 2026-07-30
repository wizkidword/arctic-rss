# Trusted ingress verification

**Reconciled:** 2026-07-29, with provider/OVH cross-check
**Scope:** `NET-001` read-only OVH verification. No firewall, DNS, tunnel,
proxy, or VPS configuration was changed.

## Current evidence

- The canonical public health endpoint returned `200 {"status":"ok"}` over
  HTTPS and the public login surface returned HTTP 200.
- The provider dashboard confirms that the canonical hostname and `www` are
  proxied through the same Cloudflare Tunnel, and that tunnel reports healthy.
  Tunnel names, identifiers, connector metadata, and DNS targets remain in the
  private operator inventory.
- The provider inventory shows one healthy Linux connector replica. A
  read-only inventory of that connector found a separate OVH relay host with
  one running `cloudflared` container and no Arctic RSS application
  containers. Its public origin does not match the configured OVH application
  host.
- Four application/data listeners were present on the OVH host, all
  loopback-bound. No listener on ports 3000, 3001, 5432, 6379, or 6380 was
  bound beyond loopback, and the host firewall was active.
- The chat gateway remains unpublished and intentionally inactive. Do not use
  its older WebSocket acceptance result as evidence for the current release.
- A fresh read-only OVH check found healthy web, worker, PostgreSQL, and both
  Redis services, plus successful loopback liveness. It also found no running
  `cloudflared` process, container, or service unit, and no non-loopback
  listener on the standard web or Cloudflare Tunnel ports. The provider's
  healthy tunnel therefore does not prove that its active connector runs on
  this OVH host.
- The relay's Cloudflared ingress rule sends the canonical hostname to a
  single-label internal service rather than a local listener, private/public
  IP literal, or public hostname. The safe read-only inventory could not
  resolve that service from the connector's runtime namespace, so the final
  relay-to-application hop remains unverified.
- The previous packet-path diagram named an active OVH `cloudflared`
  connector. That diagram is historical evidence, not a statement about the
  current route.
- `src/proxy.ts` still validates `Host` before routing and does not use
  forwarding headers to choose security-sensitive application URLs. The chat
  rate limiter accepts only Cloudflare's `CF-Connecting-IP`, not
  `X-Forwarded-For`.

## Current classification

`NET-001` remains **incomplete**. The established portion is:

```text
Browser -> Cloudflare edge -> healthy Cloudflare Tunnel -> verified OVH relay -> unverified internal service -> application
```

The canonical and `www` records do not bypass the Cloudflare edge, but this
does not establish that no other application alias can bypass it. It also does
not prove the relay's named upstream reaches the intended application host or
that trusted headers are overwritten at the final ingress boundary.

## Required closure before claiming an exact packet path

The active connector is now identified as a separate OVH relay. Use the
private relay and resolver inventory to identify its named upstream and confirm
that it reaches the intended OVH application host, then record only the
non-secret topology:

```text
Browser -> Cloudflare edge -> verified OVH connector/proxy -> loopback web
```

Confirm that it is the sole application ingress, that forwarding headers are
overwritten at the trusted boundary, and that an alternate DNS record cannot
bypass the edge. Perform a controlled canonical WebSocket upgrade only after
the opt-in chat gateway has separately been activated.

This is an evidence task, not authorization to start a tunnel, expose a port,
change DNS/Cloudflare, or activate chat.
