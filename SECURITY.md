# Security Policy

Arctic RSS fetches remote URLs and renders feed-provided content, so security issues matter.

Please report vulnerabilities privately before opening public issues. Include:

- Affected route or feature
- Reproduction steps
- Expected impact
- Any relevant logs

Security priorities:

- SSRF protection for feed fetching
- Strict user data isolation
- Sanitized article HTML
- Rate limits for signup, feed imports, refreshes, and AI requests
- Admin action audit logs
