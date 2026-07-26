import { expect, test } from "playwright/test"

test("enforces CSP while the public application remains usable", async ({ page }) => {
  const applicationViolationReports: string[] = []

  await page.route("**/api/csp-report", async (route) => {
    applicationViolationReports.push(route.request().postData() ?? "")
    await route.fulfill({ status: 204 })
  })

  const response = await page.goto("/")
  const policy = response?.headers()["content-security-policy"]

  expect(policy).toContain("'nonce-")
  expect(policy).toContain("'strict-dynamic'")
  expect(policy).toContain("report-uri /api/csp-report")
  await expect(page.getByRole("link", { name: "Browse as Guest" })).toBeVisible()
  if (process.env.E2E_PRODUCTION === "1") {
    await page.waitForTimeout(250)
    expect(applicationViolationReports).toEqual([])
  }

  // The probe validates enforcement itself; omitting report delivery keeps the
  // local test independent of Cloudflare's trusted client-IP header.
  const probePolicy = policy?.replace("; report-uri /api/csp-report", "") ?? ""

  await page.route("**/csp-inline-probe", async (route) => {
    await route.fulfill({
      body: "<!doctype html><script>window.__arcticRssInlineScriptExecuted = true</script><p>probe</p>",
      contentType: "text/html",
      headers: {
        "content-security-policy": probePolicy,
      },
    })
  })

  await page.goto("/csp-inline-probe")
  await expect(page.getByText("probe")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Reflect.get(window, "__arcticRssInlineScriptExecuted") === true
      )
    )
    .toBe(false)
})
