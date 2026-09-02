import { expect, test } from "@playwright/test";

const ANALYTICS_HOSTS = /posthog|google-analytics|googletagmanager|segment\.io|mixpanel|plausible|amplitude/i;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test("DNT does not emit third-party analytics from the public workbench", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "doNotTrack", { configurable: true, get: () => "1" });
  });
  const analyticsRequests: string[] = [];
  page.on("request", request => { if (ANALYTICS_HOSTS.test(request.url())) analyticsRequests.push(request.url()); });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => navigator.doNotTrack)).toBe("1");
  expect(analyticsRequests).toEqual([]);
});

test("source canary is not persisted in browser storage after a free scan", async ({ page }) => {
  const canary = `PC_PRIVACY_TEXT_${crypto.randomUUID()}`;
  await page.goto("/");
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByLabel("Text to scan").fill(`${canary}\u200B`);
  await scanner.getByRole("button", { name: "Scan text" }).click();
  await expect(scanner.getByText(/finding/i).first()).toBeVisible();

  const persisted = await page.evaluate(async marker => {
    const local = Object.entries(localStorage).map(([key, value]) => `${key}:${value}`).join("\n");
    const session = Object.entries(sessionStorage).map(([key, value]) => `${key}:${value}`).join("\n");
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const cacheNames = "caches" in window ? await caches.keys() : [];
    return {
      local: local.includes(marker),
      session: session.includes(marker),
      indexedDbName: databases.some(item => item.name?.includes(marker)),
      cacheName: cacheNames.some(name => name.includes(marker)),
      cookie: document.cookie.includes(marker),
    };
  }, canary);
  expect(persisted).toEqual({ local: false, session: false, indexedDbName: false, cacheName: false, cookie: false });
});

test("contact message stays client-side and only prepares mailto behavior", async ({ page }) => {
  const canary = `PC_CONTACT_${crypto.randomUUID()}`;
  const applicationPosts: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).origin === "http://127.0.0.1:3000") applicationPosts.push(request.url());
  });
  await page.goto("/contact");
  await page.getByLabel("Subject").fill("Privacy test");
  await page.getByLabel("Message").fill(canary);
  const submit = page.getByRole("button", { name: "Send message" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.waitForTimeout(250);
  expect(applicationPosts).toEqual([]);
  expect(await page.evaluate(marker => document.documentElement.innerHTML.includes(marker), canary)).toBe(true);
});

test("public surfaces have labeled controls, main landmarks and no horizontal overflow across launch widths", async ({ page }) => {
  test.setTimeout(120_000);
  const widths = [375, 390, 768, 1024, 1440];
  const routes = ["/", "/pricing", "/auth", "/contact", "/privacy", "/terms", "/cookies", "/faq", "/how-it-works", "/capabilities", "/mission"];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }
});

test("core workbench is keyboard reachable and exposes accessible async regions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Account and credits" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Provenance text scanner" })).toBeVisible();
  await expect(page.getByRole("region", { name: "File metadata scanner" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Semantics-preserving editor" })).toBeVisible();
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? null);
  expect(focused).not.toBe("BODY");
  await expect(page.getByRole("region", { name: "Semantics-preserving editor" }).locator('[aria-live="polite"]')).toHaveCount(1);
});
