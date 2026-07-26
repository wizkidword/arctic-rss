# Trusted ingress verification

**Verified:** 2026-07-26  
**Scope:** `NET-001` read-only production verification. No firewall, DNS, tunnel, or VPS configuration was changed.

## Verified packet paths

```text
Browser
  -> public DNS
  -> Cloudflare HTTPS edge
  -> managed cloudflared connector on the VPS
  -> Docker loopback web listener (127.0.0.1:3000)
  -> Arctic RSS

Canonical WebSocket upgrade (/socket.io)
  -> Cloudflare HTTPS edge and managed connector
  -> internal chat gateway
```

The chat gateway has no host-published port. Its canonical WebSocket route
accepted a standards-valid upgrade through the managed edge; it is not
reachable as direct TCP port `3001`.

## Evidence collected

- The public canonical health endpoint returned `200` over HTTPS, included a
  Cloudflare response marker and HSTS, and public DNS resolved.
- Direct TCP checks from an external workstation reached controlled SSH only.
  Ports `80`, `443`, `3000`, `3001`, `5432`, `6379`, and `6380` were not
  reachable directly on the VPS address.
- The host firewall was active. This effective external result agrees with the
  host policy: provider-side rules are not stored in the repository, but the
  direct checks crossed the provider boundary and found no alternate ingress.
- Docker publishes web, PostgreSQL, durable Redis, and ephemeral Redis only on
  loopback. The chat gateway is unpublished on the host.
- The managed tunnel process, SSH service, and chat gateway were active during
  verification.
- The canonical local health request succeeded. The same request with an
  unknown `Host` returned `400`.
- `src/proxy.ts` validates `Host` before routing and never uses forwarding
  headers to choose security-sensitive application URLs. The rate limiter uses
  only Cloudflare's `CF-Connecting-IP`, not `X-Forwarded-For`.

## Operational boundary

Provider firewall rule listings and Cloudflare dashboard policy are maintained
in private operator inventory and were not modified or copied into this
repository. Re-run this read-only verification after any provider, DNS,
tunnel, reverse-proxy, or Compose port-mapping change.
