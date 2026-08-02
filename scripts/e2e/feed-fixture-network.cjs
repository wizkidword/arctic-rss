/* eslint-disable @typescript-eslint/no-require-imports -- Node loads this test-only network hook with --require. */
"use strict"

const dnsPromises = require("node:dns/promises")
const E2E_FIXTURE_MARKER = Symbol.for("arctic-rss.e2e.feed-fixture-network")

function installFixtureNetworkHooks() {
  if (process.env.ARCTIC_RSS_E2E_FIXTURES !== "1") {
    return
  }

  if (globalThis[E2E_FIXTURE_MARKER]) {
    return
  }

  const fixtureHost = process.env.ARCTIC_RSS_E2E_FEED_HOST
  const fixtureOrigin = process.env.ARCTIC_RSS_E2E_FEED_ORIGIN

  if (!fixtureHost || !fixtureOrigin) {
    throw new Error(
      "ARCTIC_RSS_E2E_FEED_HOST and ARCTIC_RSS_E2E_FEED_ORIGIN are required for E2E feed fixtures."
    )
  }

  const normalizedFixtureHost = fixtureHost.toLowerCase()
  const originalLookup = dnsPromises.lookup

  dnsPromises.lookup = async function fixtureLookup(hostname, options) {
    if (String(hostname).toLowerCase() === normalizedFixtureHost) {
      const result = { address: "93.184.216.34", family: 4 }
      return options && typeof options === "object" && options.all
        ? [result]
        : result
    }

    return originalLookup.call(this, hostname, options)
  }

  globalThis[E2E_FIXTURE_MARKER] = true
}

installFixtureNetworkHooks()

module.exports = { installFixtureNetworkHooks }
