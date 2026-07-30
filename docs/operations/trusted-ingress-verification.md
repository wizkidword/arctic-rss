# Trusted ingress verification

**Reconciled:** 2026-07-29, with provider/OVH cross-check
**Scope:** `NET-001` non-destructive OVH verification. A cached, short-lived
resolver helper ran in the relay's existing connector network and removed
itself; no firewall, DNS, tunnel, proxy, or VPS configuration was changed.

## Current evidence

- The canonical public health endpoint returned `200 {"status":"ok"}` over
  HTTPS and the public login surface returned HTTP 200.
- The provider dashboard confirms that the canonical hostname and `www` are
  proxied through the same Cloudflare Tunnel, and that tunnel reports healthy.
  Tunnel names, identifiers, connector metadata, and DNS targets remain in the
  private operator inventory.
- A read-only provider DNS inventory found no DNS-only `A`, `AAAA`, or `CNAME`
  application record. The current web-capable records are proxied; DNS-only
  records are mail/text records, so no current DNS bypass candidate was found.
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
  IP literal, or public hostname. A cached, auto-removed helper sharing the
  connector network received the expected `{"status":"ok"}` response from that
  service's `/api/health` endpoint. Its standalone DNS utility was
  non-diagnostic, so the service address and exact host identity remain in the
  private operator inventory.
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
Browser -> Cloudflare edge -> healthy Cloudflare Tunnel -> verified OVH relay -> verified internal Arctic RSS health endpoint
```

The canonical, `www`, and current provider DNS inventory do not expose a DNS
bypass candidate. The health response proves the relay's named upstream reaches
Arctic RSS, but does not map that service to the intended application host or
prove trusted headers are overwritten at the final ingress boundary.

## Required closure before claiming an exact packet path

The active connector and its Arctic RSS health response are now verified. Use
the private relay and resolver inventory to map the named upstream to the
intended OVH application host, then record only the non-secret topology:

```text
Browser -> Cloudflare edge -> verified OVH connector/proxy -> loopback web
```

Confirm that it is the sole application ingress, that forwarding headers are
overwritten at the trusted boundary. Perform a controlled canonical WebSocket
upgrade only after the opt-in chat gateway has separately been activated.

This is an evidence task, not authorization to start a tunnel, expose a port,
change DNS/Cloudflare, or activate chat.
