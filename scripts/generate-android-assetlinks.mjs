#!/usr/bin/env node

const expectedPackage = "com.arcticrss.reader"
const argumentsByName = new Map()

for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index]
  const value = process.argv[index + 1]
  if (!name?.startsWith("--") || !value || argumentsByName.has(name)) {
    fail("Usage: node scripts/generate-android-assetlinks.mjs --package com.arcticrss.reader --sha256-cert-fingerprint AA:BB:...")
  }
  argumentsByName.set(name, value)
}

const packageName = argumentsByName.get("--package")
const fingerprint = argumentsByName.get("--sha256-cert-fingerprint")?.toUpperCase()
if (argumentsByName.size !== 2 || packageName !== expectedPackage) {
  fail(`The package must be the registered Android application ID: ${expectedPackage}.`)
}
if (!fingerprint || !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint)) {
  fail("The SHA-256 certificate fingerprint must contain exactly 32 hexadecimal bytes separated by colons.")
}
if (/^(00:){31}00$/.test(fingerprint) || /(?:EXAMPLE|PLACEHOLDER|YOUR)/.test(fingerprint)) {
  fail("Placeholder certificate fingerprints are not permitted.")
}

process.stdout.write(`${JSON.stringify([{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: packageName,
    sha256_cert_fingerprints: [fingerprint],
  },
}], null, 2)}\n`)

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
