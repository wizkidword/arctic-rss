#!/usr/bin/env node

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const candidate = JSON.parse(await readFile(join(root, "docs", "mobile", "release-candidate.json"), "utf8"))
const appConfig = JSON.parse(await readFile(join(root, "apps", "mobile", "app.json"), "utf8"))
const assetLinks = JSON.parse(await readFile(join(root, "public", ".well-known", "assetlinks.json"), "utf8"))
const status = await readFile(join(root, "docs", "mobile", "release-candidate-status.md"), "utf8")

assert.equal(candidate.schemaVersion, 1, "Unsupported release-candidate manifest version.")
assert.match(candidate.sourceCommit, /^[a-f0-9]{40}$/, "Candidate source commit must be an exact SHA.")
assert.match(candidate.buildId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i, "Candidate build ID must be a UUID.")
assert.equal(candidate.packageName, appConfig.expo.android.package, "Candidate package must match Android config.")
assert.equal(candidate.versionName, appConfig.expo.version, "Candidate version must match Android config.")
assert.equal(candidate.versionCode, appConfig.expo.android.versionCode, "Candidate versionCode must match Android config.")
assert.ok(Number.isInteger(candidate.targetSdk) && candidate.targetSdk >= 35, "Candidate target SDK must be recorded.")
assert.match(candidate.artifactSha256, /^[a-f0-9]{64}$/, "Candidate archive SHA-256 is invalid.")
assert.ok(candidate.candidateStatus === "CURRENT" || candidate.candidateStatus === "SUPERSEDED", "Candidate status is invalid.")
assert.equal(candidate.appLinksLive, false, "Live App Links need separately verified owner evidence.")
assert.equal(candidate.signedDeviceSmoke, false, "Signed-device smoke needs recorded device evidence.")
assert.equal(candidate.playUpload, false, "Play upload needs explicit owner approval.")
assert.equal(candidate.playTrack, null, "No Play track is recorded for this candidate.")

const fingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/
assert.ok(candidate.signingCertificateSha256.length > 0, "Candidate must record an App Link certificate fingerprint.")
for (const fingerprint of candidate.signingCertificateSha256) {
  assert.match(fingerprint, fingerprintPattern, "Candidate certificate fingerprint is malformed.")
}

assert.deepEqual(assetLinks, [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: candidate.packageName,
    sha256_cert_fingerprints: candidate.signingCertificateSha256,
  },
}], "Staged assetlinks.json must be generated from the release-candidate manifest.")

const declaredRoutes = appConfig.expo.android.intentFilters
  .flatMap((filter) => filter.data ?? [])
  .filter((data) => data.scheme === "https" && data.host === "arcticrss.com")
  .map((data) => data.pathPrefix)
  .sort()
assert.deepEqual(declaredRoutes, [...candidate.appLinkRoutes].sort(), "App Link routes drifted from the candidate manifest.")

for (const value of [candidate.sourceCommit, candidate.buildId, candidate.artifactSha256, candidate.candidateStatus]) {
  assert.ok(status.includes(String(value)), "Generated candidate status drifted from the manifest.")
}

console.log(`Android release candidate verified: ${candidate.candidateStatus}, ${candidate.packageName}, ${candidate.appLinkRoutes.length} App Link routes.`)
