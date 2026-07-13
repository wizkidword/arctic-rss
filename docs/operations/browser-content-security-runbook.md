# Browser Content Security Runbook

## Purpose

Arctic RSS renders third-party feed content. This runbook records the browser
boundary that keeps that content from making a reader's browser load arbitrary
resources or execute supplied markup.

## Article rendering boundary

`src/lib/articles.ts` is the only producer of `SanitizedArticleHtml`. It
sanitizes the untrusted feed body before a reader view receives it. Components
may use `dangerouslySetInnerHTML` only with that branded value; raw feed HTML
is not part of the reader article type.

Sanitization removes scripts, event handlers, embedded frames, style payloads,
SVG/MathML active content, and unsafe URLs. Image source URLs are changed to
the same-origin `/api/image` endpoint before rendering.

## Image proxy controls

`/api/image` is the required browser-facing path for article images, feed
favicons, and podcast artwork that originate outside Arctic RSS.

- The endpoint reuses `src/lib/url-safety.ts`, including public-DNS validation,
  pinned network connections, redirect checks, bounded timeouts, and the
  per-host concurrency limit.
- It only accepts `http` and `https` image URLs, removes URL fragments, and
  sends no browser cookie, authorization, or referer headers upstream.
- It caps the response at 5 MiB and only serves AVIF, BMP, GIF, JPEG, PNG,
  WebP, and ICO MIME types. SVG is intentionally excluded.
- Responses have `nosniff`, `no-referrer`, and same-origin resource policy
  headers. They are cacheable for a day in the browser and a week at a shared
  cache; the application does not persist image bytes in its database.
- The endpoint is IP-rate-limited through Redis. It fails closed if the limiter
  is unavailable.

If an image source fails, the browser receives no usable image from the
endpoint; the UI's normal image error handling or fallback presentation
applies. Do not add direct third-party `img` or `Image` sources as a shortcut.

## CSP observation phase

The application now returns `Content-Security-Policy-Report-Only` on all
routes. It deliberately does not block page behavior yet. This lets production
traffic identify the exact nonce or hash work needed for Next.js inline boot
code and the currently trusted inline theme and analytics scripts.

Violation reports post to `/api/csp-report`. The endpoint accepts classic CSP
and Reporting API payloads up to 8 KiB, logs only a small set of metadata, and
reduces page and blocked URLs to their origin. It does not retain paths, query
parameters, credentials, reader data, or cookies.

Inspect report-only events without exposing environment values:

```bash
cd /opt/arctic-rss/app
docker compose logs --since=24h web | grep 'csp_violation_report'
```

Before moving to an enforcing `Content-Security-Policy` header, observe at
least one normal reader session, login/signup flow, podcast view, guest view,
Turnstile-enabled flow if configured, analytics-enabled flow if configured,
and an embedded YouTube article. Then replace permitted inline scripts with
Next.js nonce or hash handling and leave only documented external origins in
the enforced policy. Do not convert this header to enforcement merely because
the site appears to load in one browser.

## Release verification

Before release:

```powershell
npm test -- --run src/lib/articles.test.ts src/lib/url-safety.test.ts src/lib/image-proxy.test.ts src/lib/image-proxy-url.test.ts src/app/api/image/route.test.ts src/lib/content-security-policy.test.ts src/app/api/csp-report/route.test.ts
npm run typecheck
npm run lint
npm run build
```

After deployment, verify `https://arcticrss.com/api/health`, then inspect the
response headers of `https://arcticrss.com/login` for
`content-security-policy-report-only`. Request one known public PNG or favicon
through `/api/image?url=...` and confirm a safe image content type plus the
proxy cache and privacy headers. Do not test the endpoint with private, local,
or credential-bearing URLs from production.
