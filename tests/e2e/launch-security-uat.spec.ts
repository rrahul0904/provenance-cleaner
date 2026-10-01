import { expect, test } from "@playwright/test";

test("cross-site mutations are rejected before account or billing logic", async ({ request }) => {
  const response = await request.post("/api/auth/anonymous", {
    headers: {
      origin: "https://attacker.invalid",
      "content-type": "application/json",
    },
    data: {},
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({
    error: { code: "cross_site_request_blocked" },
  });
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("safe cross-site reads remain available while sensitive anonymous API responses are non-cacheable", async ({ request }) => {
  const health = await request.get("/api/health", {
    headers: { origin: "https://attacker.invalid" },
  });
  expect(health.status()).toBe(200);

  const balance = await request.get("/api/billing/balance");
  expect(balance.status()).toBe(401);
  expect(balance.headers()["cache-control"]).toBe("no-store");
});

test("first-time visitor can complete the free inspection journey and understand next steps", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: /Know what your content is carrying/i })).toBeVisible();
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByLabel("Text to scan").fill("Launch-ready copy\u200B with an invisible marker.");
  await scanner.getByRole("button", { name: "Scan text" }).click();

  await expect(scanner.getByText(/1 finding/i)).toBeVisible();
  await expect(scanner.getByTestId("forensic-text-explorer")).toBeVisible();

  const receiptButton = page.getByRole("button", { name: "View latest verification receipt" });
  await expect(receiptButton).toBeVisible();
  await receiptButton.click();
  await expect(page.getByRole("dialog", { name: "Text inspection receipt" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Usage & pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/u);
  await expect(page.getByRole("heading", { name: "Predictable processing allowance.", exact: true })).toBeVisible();

  await page.goto("/");
  const filesTab = page.getByRole("tab", { name: /^Files/i });
  const rewriteTab = page.getByRole("tab", { name: /^Rewrite/i });
  await expect(filesTab).toBeVisible();
  await expect(rewriteTab).toBeVisible();
});
