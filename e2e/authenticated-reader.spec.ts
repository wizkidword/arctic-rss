import { expect, test, type Locator, type Page } from "playwright/test"

import {
  e2eCredentials,
  e2eFeedUrl,
  e2ePassword,
  processLatestOpmlImportForUser,
} from "./support/fixtures"

const hasAuthenticatedFixtures =
  process.env.ARCTIC_RSS_E2E_AUTHENTICATED === "1"

test.describe("authenticated reader journeys", () => {
  // These journeys share an authenticated fixture database. Run them in order so
  // a mutating admin action is not delayed by unrelated fixture traffic.
  test.describe.configure({ mode: "serial" })

  test.skip(
    !hasAuthenticatedFixtures,
    "Authenticated reader fixtures are enabled only for the production E2E job."
  )

  test("adds, reads, stars, and persists a deterministic feed article", async ({
    page,
  }) => {
    await signIn(page, e2eCredentials.reader)
    await expect(page).toHaveURL(/\/app(?:\/discover)?/)

    await page.getByRole("button", { name: "Add Feed" }).click()
    await page
      .getByLabel("Feed or website URL")
      .fill(`${e2eFeedUrl}/reader.xml`)
    await page.getByRole("button", { name: "Subscribe" }).click()
    await expect(
      page.getByText(
        /Subscribed to E2E Reader Feed\. Imported 1 articles\.|You are already subscribed to E2E Reader Feed\./
      )
    ).toBeVisible()

    await page.goto("/app")
    const articleLink = page.getByRole("link", { name: "E2E Reader Article One" })
    await expect(articleLink).toBeVisible()
    await articleLink.click({ position: { x: 8, y: 8 } })
    await page.waitForLoadState("networkidle")

    const toolbar = page.getByRole("toolbar", {
      name: "E2E Reader Article One actions",
    })
    await setArticleRead(page, toolbar, true)
    await expect(toolbar.getByRole("button", { name: "Mark as unread" })).toBeVisible()
    await setArticleStarred(page, toolbar, true)
    await expect(toolbar.getByRole("button", { name: "Unstar post" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Starred 1" })).toBeVisible()

    await page.goto("/app/starred")
    const persistedArticleLink = page.getByRole("link", {
      name: "E2E Reader Article One",
    })
    await expect(persistedArticleLink).toBeVisible()
    await persistedArticleLink.click({ position: { x: 8, y: 8 } })
    const persistedToolbar = page.getByRole("toolbar", {
      name: "E2E Reader Article One actions",
    })
    await expect(
      persistedToolbar.getByRole("button", { name: "Mark as unread" })
    ).toBeVisible()
    await expect(
      persistedToolbar.getByRole("button", { name: "Unstar post" })
    ).toBeVisible()
  })

  test("keeps a saved article available after its source is unsubscribed until it is removed", async ({
    page,
  }) => {
    await signIn(page, e2eCredentials.collection)
    await page.getByRole("button", { name: "Add Feed" }).click()
    await page.getByLabel("Feed or website URL").fill(`${e2eFeedUrl}/collection.xml`)
    await page.getByRole("button", { name: "Subscribe" }).click()
    await expect(
      page.getByText(
        /Subscribed to E2E Collection Feed\. Imported 1 articles\.|You are already subscribed to E2E Collection Feed\./
      )
    ).toBeVisible()

    await page.goto("/app")
    await page
      .getByRole("link", { name: "E2E Collection Article One" })
      .click({ position: { x: 8, y: 8 } })

    const articleToolbar = page.getByRole("toolbar", {
      name: "E2E Collection Article One actions",
    })
    await articleToolbar.getByRole("button", { name: "Save to collection" }).click()
    const collectionDialog = page.getByRole("dialog", {
      name: "Save to collection",
    })
    await collectionDialog
      .getByLabel("New collection name")
      .fill("E2E Read Later")
    await collectionDialog.getByRole("button", { name: "Save" }).click()
    await expect(collectionDialog).not.toBeVisible()

    await page.goto("/app/folders")
    await page
      .getByRole("button", { name: "Unsubscribe from E2E Collection Feed" })
      .click()
    const unsubscribeDialog = page.getByRole("dialog", {
      name: "Unsubscribe from E2E Collection Feed?",
    })
    await unsubscribeDialog.getByRole("button", { name: "Unsubscribe" }).click()
    await expect(
      page.getByRole("button", { name: "Unsubscribe from E2E Collection Feed" })
    ).not.toBeVisible()

    await page.goto("/app")
    await expect(
      page.getByRole("link", { name: "E2E Collection Article One" })
    ).not.toBeVisible()

    await page.goto("/app/collections")
    const collectionLink = page.getByRole("link", { name: /^E2E Read Later \d+$/ })
    await expect(collectionLink).toBeVisible()
    const collectionHref = await collectionLink.getAttribute("href")
    expect(collectionHref).toMatch(/^\/app\/collections\/[A-Za-z0-9_-]+$/)
    await collectionLink.click()
    await expect(
      page.getByRole("link", { name: "E2E Collection Article One" })
    ).toBeVisible()
    const permalink = page.getByRole("link", { name: "Permalink" })
    const permalinkHref = await permalink.getAttribute("href")
    expect(permalinkHref).toMatch(/^\/app\/article\/[A-Za-z0-9_-]+$/)
    await permalink.click()
    await expect(page).toHaveURL(/\/app\/article\/[A-Za-z0-9_-]+$/)
    await expect(
      page.getByRole("toolbar", { name: "E2E Collection Article One actions" })
    ).toBeVisible()

    await page.goto(collectionHref!)
    const collectionArticleToolbar = page.getByRole("toolbar", {
      name: "E2E Collection Article One actions",
    })
    await setArticleStarred(page, collectionArticleToolbar, true)
    await expect(
      collectionArticleToolbar.getByRole("button", { name: "Unstar post" })
    ).toBeVisible()
    await setArticleStarred(page, collectionArticleToolbar, false)
    await expect(
      collectionArticleToolbar.getByRole("button", { name: "Star post" })
    ).toBeVisible()
    await setArticleStarred(page, collectionArticleToolbar, true)
    await setArticleRead(page, collectionArticleToolbar, true)
    await expect(
      collectionArticleToolbar.getByRole("button", { name: "Mark as unread" })
    ).toBeVisible()
    await setArticleRead(page, collectionArticleToolbar, false)
    await expect(
      collectionArticleToolbar.getByRole("button", { name: "Mark as read" })
    ).toBeVisible()
    await setArticleRead(page, collectionArticleToolbar, true)

    const collectionId = collectionHref?.split("/").at(-1)
    expect(collectionId).toBeTruthy()
    await page.goto(`/app/search?collection=${collectionId}`)
    await page.getByLabel("Search articles").fill("E2E Collection Article One")
    await page.getByRole("button", { exact: true, name: "Search" }).click()
    await expect(
      page.getByRole("link", { name: "E2E Collection Article One" })
    ).toBeVisible()

    await page.goto(collectionHref!)
    await page
      .getByRole("toolbar", { name: "E2E Collection Article One actions" })
      .getByRole("button", { name: "Remove from E2E Read Later" })
      .click()
    await expect(
      page.getByRole("link", { name: "E2E Collection Article One" })
    ).not.toBeVisible()
    await page.goto(permalinkHref!)
    await expect(
      page.getByRole("link", { name: "E2E Collection Article One" })
    ).not.toBeVisible()
  })

  test("imports OPML into a folder and safely skips its duplicate feed", async ({
    page,
  }) => {
    test.setTimeout(60_000)

    await signIn(page, e2eCredentials.opml)
    await page.goto("/app/settings/import-export")

    await page.getByLabel("OPML file").setInputFiles({
      buffer: Buffer.from(opmlFixtureDocument()),
      mimeType: "text/xml",
      name: "e2e-import.opml",
    })
    await page.getByRole("button", { name: "Import OPML" }).click()
    await expect(page.getByText("Import queued for 3 feeds.")).toBeVisible()

    await expect
      .poll(() => processLatestOpmlImportForUser(e2eCredentials.opml.email), {
        intervals: [500, 1_000],
        timeout: 45_000,
      })
      .toMatchObject({ status: "COMPLETED" })
    await page.reload()

    const importSummary = page.locator("p").filter({ hasText: "3 of 3 processed" })
    await expect(importSummary).toContainText("2 added")
    await expect(importSummary).toContainText("1 skipped")
    await expect(importSummary).toContainText("0 failed")
    await expect(importSummary).toContainText("1 folders")
    await page.goto("/app/folders")
    await expect(
      page.getByRole("link", { exact: true, name: "E2E Imports" })
    ).toBeVisible()
    await expect(
      page.getByLabel("Folder for E2E OPML Feed A").locator("option:checked")
    ).toHaveText("E2E Imports")
    await expect(
      page.getByLabel("Folder for E2E OPML Feed B").locator("option:checked")
    ).toHaveText("E2E Imports")
  })

  test("searches, saves, reopens, and deletes a private search shortcut", async ({
    page,
  }) => {
    await signIn(page, e2eCredentials.search)
    await page.goto("/app/search")

    await page.getByLabel("Search articles").fill("E2E Search Phrase")
    await page.getByRole("button", { exact: true, name: "Search" }).click()
    await expect(
      page.getByRole("link", { name: "E2E Search Phrase Result" })
    ).toBeVisible()

    await page.getByRole("link", { name: "Save search" }).click()
    await page.getByLabel("Saved search name").fill("E2E Search Shortcut")
    await page.getByRole("button", { name: "Save search" }).click()
    await expect(page).toHaveURL(/\/app\/saved-searches/)

    const savedSearch = page.getByRole("article").filter({
      hasText: "E2E Search Shortcut",
    })
    await expect(savedSearch).toBeVisible()
    await savedSearch.getByRole("link", { name: "E2E Search Shortcut" }).click()
    await expect(
      page.getByRole("link", { name: "E2E Search Phrase Result" })
    ).toBeVisible()

    await page.goto("/app/saved-searches")
    await savedSearch.getByRole("button", { name: "Delete" }).click()
    await expect(
      page.getByRole("link", { name: "E2E Search Shortcut" })
    ).not.toBeVisible()
  })

  test("persists a reader setting across a full page reload", async ({ page }) => {
    await signIn(page, e2eCredentials.settings)
    await page.goto("/app/settings")

    const readerMode = page.getByRole("button", {
      name: "Use Reader display mode",
    })
    await readerMode.click()
    await expect(readerMode).toHaveAttribute("aria-pressed", "true")
    await expect(readerMode).toBeEnabled()

    await page.reload()
    await expect(
      page.getByRole("button", { name: "Use Reader display mode" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("disabling a user revokes their active protected session", async ({
    browser,
  }) => {
    test.setTimeout(45_000)

    const readerContext = await browser.newContext()
    const readerPage = await readerContext.newPage()
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    try {
      await signIn(readerPage, e2eCredentials.revoked)
      await expect(readerPage).toHaveURL(/\/app(?:\/discover)?/)
      const activeChatAuthorization = await readerPage.request.post(
        "/api/chat/session",
        {
          headers: {
            "cf-connecting-ip": "203.0.113.10",
            origin: process.env.APP_ORIGIN ?? "https://localhost:3300",
          },
        }
      )
      expect(activeChatAuthorization.ok()).toBe(true)

      await signIn(adminPage, e2eCredentials.admin)
      await adminPage.goto("/admin")
      const targetRow = adminPage.getByRole("row").filter({
        hasText: e2eCredentials.revoked.email,
      })
      await expect(targetRow).toBeVisible()
      await clickServerAction(
        adminPage,
        targetRow.getByRole("button", { name: "Disable user" })
      )

      await readerPage.goto("/app")
      await expect(readerPage).toHaveURL(/\/login/)
    } finally {
      await Promise.all([adminContext.close(), readerContext.close()])
    }
  })
})

async function clickArticleAction(page: Page, button: Locator) {
  await button.click()
  await page.waitForLoadState("networkidle")
}

async function clickServerAction(page: Page, button: Locator) {
  const response = page.waitForResponse((candidate) => {
    const request = candidate.request()
    return request.method() === "POST" && Boolean(request.headers()["next-action"])
  })

  await button.click()
  await response
}

async function setArticleRead(page: Page, toolbar: Locator, isRead: boolean) {
  const button = toolbar.getByRole("button", {
    name: isRead ? "Mark as read" : "Mark as unread",
  })

  if (await button.isVisible()) {
    await clickArticleAction(page, button)
  }
}

async function setArticleStarred(page: Page, toolbar: Locator, isStarred: boolean) {
  const button = toolbar.getByRole("button", {
    name: isStarred ? "Star post" : "Unstar post",
  })

  if (await button.isVisible()) {
    await clickArticleAction(page, button)
  }
}

async function signIn(
  page: Page,
  user: (typeof e2eCredentials)[keyof typeof e2eCredentials]
) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(e2ePassword)
  await page.getByRole("button", { name: "Log in" }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

function opmlFixtureDocument() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="E2E Imports">
      <outline text="E2E OPML Feed A" type="rss" xmlUrl="${e2eFeedUrl}/opml-a.xml" />
      <outline text="E2E OPML Feed A duplicate" type="rss" xmlUrl="${e2eFeedUrl}/opml-a.xml" />
      <outline text="E2E OPML Feed B" type="rss" xmlUrl="${e2eFeedUrl}/opml-b.xml" />
    </outline>
  </body>
</opml>`
}
