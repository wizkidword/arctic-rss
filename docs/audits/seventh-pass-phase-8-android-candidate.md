# Seventh-pass Phase 8: Android candidate provenance

`docs/mobile/release-candidate.json` is now the one machine-readable record
for the already completed preview AAB: source SHA, EAS build ID, package,
version, target SDK, archive checksum, certificate fingerprint, permissions,
App Link route set, and truthful release flags. The candidate delta report
classifies the source differences and marks it **SUPERSEDED** because native
runtime, server mobile API, authentication, and build-configuration source has
changed since `bf6564902bf3e406615ba4e2339a02a6535a0f61`.

`npm run mobile:verify-release-candidate` validates the manifest, generated
status document, staged `assetlinks.json`, certificate formatting, and exact
Android intent-filter routes. It makes no request to EAS, Play, or the live
website. A replacement AAB, certificate action, public App Links deployment,
and signed-device test remain explicit owner-gated work.
