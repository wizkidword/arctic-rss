# Trusted ingress verification

**Reconciled:** 2026-07-29
**Scope:** `NET-001` read-only OVH verification. No firewall, DNS, tunnel,
proxy, or VPS configuration was changed.

## Current evidence

- The canonical public health endpoint returned `200 {"status":"ok"}` over
  HTTPS and the public login surface returned HTTP 200.
- Four application/data listeners were present on the OVH host, all
  loopback-bound. No listener on ports 3000, 3001, 5432, 6379, or 6380 was
  bound beyond loopback, and the host firewall was active.
- The chat gateway remains unpublished and intentionally inactive. Do not use
  its older WebSocket acceptance result as evidence for the current release.
- The previous packet-path diagram named an active `cloudflared` connector.
  The current read-only host check did not find a running named `cloudflared`
  service, process, or container, and no direct HTTP/HTTPS listener was
  observed on the host. The old diagram is therefore historical evidence, not
  a statement about the current OVH route.
- `src/proxy.ts` still validates `Host` before routing and does not use
  forwarding headers to choose security-sensitive application URLs. The chat
  rate limiter accepts only Cloudflare's `CF-Connecting-IP`, not
  `X-Forwarded-For`.

## Required closure before claiming an exact packet path

Use the private OVH/provider and Cloudflare inventories to identify the active
edge connector or reverse proxy, then record only the non-secret topology:

```text
Browser -> Cloudflare edge -> verified OVH connector/proxy -> loopback web
```

Confirm that it is the sole application ingress, that forwarding headers are
overwritten at the trusted boundary, and that an alternate DNS record cannot
bypass the edge. Perform a controlled canonical WebSocket upgrade only after
the opt-in chat gateway has separately been activated.

This is an evidence task, not authorization to start a tunnel, expose a port,
change DNS/Cloudflare, or activate chat.
