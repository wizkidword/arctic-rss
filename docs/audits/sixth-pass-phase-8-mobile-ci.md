# Sixth-pass Phase 8: mobile CI and supply-chain evidence

**Status:** source-verified locally; no remote CI run or signed Android
artifact is represented by this record.

## Implemented source slice

The new dedicated job, **Android source, contract, and native
configuration**, installs the lockfile under Node 24, generates Prisma,
checks the mobile OpenAPI contract, runs Expo Doctor, mobile typecheck/lint,
clean Android native generation, Android JS export, focused mobile tests, the
complete mobile dependency audit, and a CycloneDX SBOM. The audit report and
SBOM are retained as one 30-day CI artifact.

`assert-mobile-native-config.mjs` now copies the managed app into an isolated
temporary directory, runs Android prebuild without installing packages,
inspects the generated manifest and Gradle source, and removes the directory.
It checks the registered package/version/versionCode, exact App Link route
family and authorization callback, no production-origin development fallback,
backup/SecureStore boundaries, cleartext traffic, dangerous permissions,
exported components, non-debug release signing source, and the current
compile/target SDK. The local no-cleartext config plugin and explicit blocked
permissions leave only `INTERNET` and `VIBRATE` active in the generated
manifest.

The mobile dependency graph traverses the app workspace, internal shared
packages, runtime dependencies, and build tooling. It emits runtime/build
reachability in both the review report and SBOM. A patch-only override updates
`brace-expansion` 1.x to `1.1.18`. Two high-severity `image-size` advisories
remain in the Metro build path; both are explicit, build-only exceptions with
the decision owner, review rationale, and an expiry of 2026-09-11. The audit
fails for an expired, stale, or incomplete exception and for any unreviewed
high/critical finding.

## Local verification boundary

- Expo Doctor: 20/20 checks passed.
- Clean generated Android source: package `com.arcticrss.reader`, version
  `0.1.0`, versionCode `1`, compile SDK `36`, target SDK `36`, and only
  `INTERNET` and `VIBRATE` active permissions.
- Mobile dependency audit: 723 distinct package names queried and 3 advisory
  records produced; the two high findings are the bounded reviewed exceptions
  above.
- Mobile SBOM generation: 902 components in CycloneDX 1.5 format.

The CI job has not run remotely from this commit. The SBOM describes the
source dependency graph only; a future signed AAB requires separate signing,
build, and artifact-SBOM evidence. No production, deployment, Play, signing,
migration, or remote-repository action occurred.
