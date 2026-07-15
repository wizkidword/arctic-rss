const baseUrl = (process.env.PH_SMOKE_BASE_URL ?? "https://arcticrss.com").replace(/\/$/, "")

const checks = [
  { path: "/", text: "Follow the open web without the noise." },
  { path: "/guest", text: "Browse as Guest" },
  { path: "/guest/discover", text: "Discover" },
  { path: "/guest/podcasts/discover", text: "Discover" },
  { path: "/api/health", text: '"status":"ok"' },
] as const

async function main() {
  const failures: string[] = []

  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`, { redirect: "error" })
    const body = await response.text()

    if (!response.ok) {
      failures.push(`${check.path}: expected a successful status, got ${response.status}.`)
      continue
    }

    if (!body.includes(check.text)) {
      failures.push(`${check.path}: expected to find ${JSON.stringify(check.text)}.`)
      continue
    }

    console.log(`PASS ${check.path} (${response.status})`)
  }

  if (failures.length > 0) {
    throw new Error(`Launch smoke failed:\n${failures.join("\n")}`)
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
