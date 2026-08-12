# Seventh-pass Phase 11: focused P3 cleanup

**Status:** source guardrails verified.

- Direct authorization-code issuance is test-only outside the production
  authorization path; Phase 4 tests cover the runtime boundary.
- Cache eviction is indexed and targeted; see the Phase 9 audit.
- Singular internal routes are canonical: `/article`, `/collection`,
  `/briefing`, `/podcast`, and `/saved-view`. Plural App-Link compatibility
  routes are lightweight Expo redirects and no longer re-export screen logic.
- Version and build provenance are canonicalized in
  `docs/mobile/release-candidate.json`; its verifier compares app configuration,
  staged App Links, manifest status, and source delta.
- `npm run mobile:verify-architecture` checks the authorization feature gate,
  idempotent replay path, production HTTPS callback, push-channel boundary,
  stable-device ownership markers, and authenticated route group.

Verification: `npm run mobile:verify-architecture`, `npm run mobile:typecheck`,
and targeted ESLint passed. No production configuration changed.
