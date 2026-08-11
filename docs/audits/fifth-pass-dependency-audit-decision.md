# Fifth-pass dependency audit decision

**Reviewed:** 2026-08-10
**Scope:** production dependency graph for the reviewed Android source and the
website release. This record is not a security waiver and does not authorize a
signed Android build or a production deployment.

## Evidence

The following checks ran with Node 24.14.0 against the committed lockfile:

```powershell
npm audit --omit=dev --audit-level=high --json
npm audit fix --dry-run --omit=dev
npx expo install --check --npm
npx expo-doctor
```

`npm audit` reported 19 advisories: 10 high, 9 moderate, and no critical
advisories. The direct affected packages are the Expo and React Native platform
dependencies. Expo Doctor passed all 20 checks, and `expo install --check`
reported compatible dependencies; React is deliberately excluded from Expo's
version check because the repository uses one reviewed hoisted React version.

The audit dry run proposed adding 127 packages and changing one package. Its
full-force resolution would install Expo 53.0.27, which npm identifies as a
breaking change and which is not a valid automated change for this SDK 57,
React Native 0.86 source tree. The moderate transitive findings include the
CLI/tooling path through `@hono/node-server` and
`@modelcontextprotocol/sdk`; the audit range alone is not sufficient reason to
override the mobile platform's managed dependency set.

## Decision

Do **not** run `npm audit fix` or `npm audit fix --force` for this repository at
this time. No dependency or lockfile was changed by this review.

Any dependency remediation must use an Expo-compatible, separately reviewed
upgrade path: select a supported Expo SDK/React Native combination, run Expo's
compatibility checks, review the lockfile delta, and repeat the mobile quality
and signed-device checks. Do not mix that work with the first internal Android
artifact unless the owner explicitly chooses that broader upgrade.

## Required recheck before signing

Immediately before a signed AAB is built, rerun the four evidence commands
above against the exact source revision. If high-severity findings remain, the
owner must either approve a reviewed Expo-compatible remediation or explicitly
accept the documented residual risk for the internal-testing artifact. A later
website release remains separately gated by its own exact `DEPLOY <short-sha>`
approval and OVH preflight.
