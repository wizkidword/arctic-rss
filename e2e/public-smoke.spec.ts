import { expect, test } from "playwright/test";

test("public landing page exposes the main reader entry points", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("img", { name: "Arctic RSS" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create account" }),
  ).toHaveAttribute("href", "/signup");
  await expect(
    page.getByRole("link", { name: "Browse as Guest" }),
  ).toHaveAttribute("href", "/guest");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("loopback liveness probe returns a minimal ready response", async ({
  request,
}) => {
  const response = await request.get("/api/live");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
