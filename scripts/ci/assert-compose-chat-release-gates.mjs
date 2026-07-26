import assert from "node:assert/strict"

const webPort = readPort("WEB_PORT", 3000)
const gatewayPort = readPort("CHAT_GATEWAY_PORT", 3001)
const isRecoveryCheck = process.argv.includes("--after-redis-restart")

if (!isRecoveryCheck) {
  const webResponse = await waitForResponse({
    headers: { host: "arcticrss.test" },
    url: `http://127.0.0.1:${webPort}/`,
  })
  const policy = webResponse.headers.get("content-security-policy")

  assert.equal(webResponse.status, 200, "The Compose web service must serve the landing page.")
  assert.ok(policy?.includes("'strict-dynamic'"), "The web service must enforce CSP.")
  assert.ok(policy?.includes("'nonce-"), "The enforced CSP must use a nonce.")
  assert.ok(policy?.includes("report-uri /api/csp-report"), "CSP reporting must remain enabled.")
  assert.equal(
    webResponse.headers.get("content-security-policy-report-only"),
    null,
    "The Compose web service must not fall back to report-only CSP."
  )
}

const gatewayResponse = await waitForResponse({
  url: `http://127.0.0.1:${gatewayPort}/ready`,
})

assert.equal(gatewayResponse.status, 200, "The Compose chat gateway must recover to ready.")
assert.deepEqual(await gatewayResponse.json(), { status: "ok" })

function readPort(name, fallback) {
  const value = Number(process.env[name] ?? fallback)

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`)
  }

  return value
}

async function waitForResponse({ headers, url }) {
  const deadline = Date.now() + 90_000
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers })

      if (response.ok) {
        return response
      }

      lastError = new Error(`${url} returned ${response.status}.`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`Timed out waiting for ${url}: ${formatError(lastError)}`)
}

function formatError(error) {
  return error instanceof Error ? error.message : "unknown error"
}
