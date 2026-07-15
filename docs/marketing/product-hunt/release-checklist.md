# Release candidate and production smoke checklist

## Pre-release (Node 22+; clean install)

- [ ] `npm install`
- [ ] `npm run prisma:generate`
- [ ] `npm run lint` (record any pre-existing warnings)
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev` (record; do not broadly auto-upgrade dependencies)
- [ ] `npm run ph:test`
- [ ] `npm run ph:assets:validate` after authorized final capture

## Approved deployment only

- [ ] Human approver supplies the exact approval required by the existing release process.
- [ ] Deployment uses the repository’s existing VPS/operator workflow; no secrets are committed or logged.
- [ ] Release SHA is recorded.
- [ ] Health and canonical-origin checks pass.

## Logged-out production smoke

- [ ] `/` loads and explains Arctic RSS within ten seconds.
- [ ] Browse as Guest is the first hero action and opens `/guest`.
- [ ] Guest reader has useful, unique current items; no empty/error state.
- [ ] Guest Discover feeds and podcasts open.
- [ ] A selected article reads cleanly at desktop and 390px mobile width.
- [ ] Article images retain aspect ratio and do not overflow.
- [ ] AI controls are closed/non-obstructive while reading.
- [ ] Login and signup routes return expected safe pages.
- [ ] Public metadata and canonical URL are correct.
- [ ] Footer legal/privacy choices work; analytics consent remains optional.

## Proposed commit sequence

1. `fix(reader): de-duplicate public guest preview articles`
2. `feat(marketing): add Product Hunt launch package and gated asset tooling`

## Pull request summary

> Prepares Arctic RSS for a Product Hunt launch without performing external actions. It promotes guest browsing in the hero, removes duplicate public-preview URLs, adds regression coverage, and includes a gated, reproducible marketing/QA/runbook package. Final assets and launch remain blocked until production and human gates pass.
