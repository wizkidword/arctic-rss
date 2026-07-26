# Image proxy hardening

The image endpoint (`GET /api/image?url=...`) fetches an unauthenticated,
public HTTP(S) source through the existing pinned-address SSRF protection, then
serves a newly encoded image. It never forwards browser cookies, authorization
headers, referrers, or client user agents upstream; its fetch client sends only
the fixed image `Accept` value and Arctic RSS proxy user agent.

## Limits and output contract

- Input download: 5 MiB maximum, with a per-host fetch limit and a total
  redirect deadline. Every redirect is normalized, DNS-checked, and connected
  through its validated public address before the next request.
- File signature: PNG, JPEG, GIF, WebP, BMP, ICO, and AVIF signatures are
  accepted. Upstream MIME headers are not trusted. SVG, HTML, and arbitrary
  bytes are rejected before decode.
- Decode: at most 16,000,000 pixels per image and 100 animation frames. The
  proxy decodes only the first frame, so animated sources become a safe static
  representation.
- Encode: metadata is not copied; the response is a static WebP at quality 82,
  capped at 4 MiB.
- Capacity: no more than two decodes run in one web process, with eight queued
  requests. Excess work receives a temporary failure instead of accumulating
  unbounded CPU or memory work.
- Cache: a browser may reuse a response for 24 hours; shared caches may reuse
  it for seven days and serve it stale for one additional day. The 4 MiB output
  ceiling bounds an individual cached response.

Successful responses set `Content-Type: image/webp`, an exact content length,
`X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`,
`Referrer-Policy: no-referrer`, a sandboxed no-content CSP, and an inline WebP
filename. Rejections use `Cache-Control: no-store`.

## Pre-release measurement

Run the reproducible maximum-pixel measurement with the release Node version:

```bash
npm run image-proxy:measure
```

It generates a 16-million-pixel raster, routes it through the same sanitizer,
and prints elapsed time plus process memory deltas. Record the sanitized JSON
result in the private release record before the first production rollout and
compare it with the web container memory limit. Do not use a production image
or production URL as the benchmark input.

### Local baseline (2026-07-26)

The current Windows development baseline, using Node `20.19.0` and sharp
`0.35.0`, processed the 16-million-pixel fixture in 530 ms. The sampled
peak-resident-set increase was 105,775,104 bytes (about 101 MiB); final RSS
settled within 1 MiB of its pre-run value. With two permitted concurrent
decodes, reserve at least twice that transient headroom above normal web
process usage. Re-run the command in the Node 24 release image before a
production rollout because allocator and native-library behavior can differ.
