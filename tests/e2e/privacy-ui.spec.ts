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

test("homepage explains the evidence loop within the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "See what your content is carrying." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free inspection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "See a verification receipt" })).toBeVisible();
  const hero = page.locator(".hero");
  await expect(hero.getByText("Drop content", { exact: true })).toBeVisible();
  await expect(hero.getByText("See hidden signals", { exact: true })).toBeVisible();
  await expect(hero.getByText("Clean safely", { exact: true })).toBeVisible();
  await expect(hero.getByText("Get proof", { exact: true })).toBeVisible();
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

test("unicode findings map to an interactive source preview", async ({ page }) => {
  await page.goto("/");
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByLabel("Text to scan").fill("Contract signed\u200B today. Review \u202Ethis marker.");
  await scanner.getByRole("button", { name: "Scan text" }).click();

  const explorer = scanner.getByTestId("forensic-text-explorer");
  await expect(explorer).toBeVisible();
  const marker = explorer.getByRole("button", { name: "Select U+200B at index 15", exact: true });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await expect(explorer.getByLabel("Selected finding source preview")).toContainText("[U+200B]");
  await expect(explorer.getByLabel("Selected finding source preview")).toContainText("ZERO WIDTH SPACE");
});

test("free scan creates an accessible exportable receipt drawer without persisting source text", async ({ page }) => {
  const canary = `PC_RECEIPT_${crypto.randomUUID()}`;
  await page.goto("/");
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByLabel("Text to scan").fill(`${canary}\u200B review`);
  await scanner.getByRole("button", { name: "Scan text" }).click();
  const latestReceipt = page.getByRole("button", { name: "View latest verification receipt" });
  await expect(latestReceipt).toBeVisible();
  await latestReceipt.click();
  const dialog = page.getByRole("dialog", { name: "Text inspection receipt" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("text.scan")).toBeVisible();
  await expect(dialog.getByText("Inspection complete.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Export JSON receipt" })).toBeVisible();
  await expect(dialog.getByText("Technical evidence")).toBeVisible();
  await expect(dialog).not.toContainText(canary);
});

test("mobile navigation remains available and keyboard dismissible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.locator('button[aria-controls="mobile-navigation"]');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Open navigation");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(trigger).toHaveAttribute("aria-label", "Close navigation");
  const mobileContainer = page.locator("#mobile-navigation");
  const mobileNav = mobileContainer.getByRole("navigation", { name: "Mobile primary" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: /Workbench/ })).toBeVisible();
  await expect(mobileContainer.getByRole("link", { name: "Start free scan" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAttribute("aria-label", "Open navigation");
  await assertNoHorizontalOverflow(page);
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

test("refinement breakpoints keep the workbench intentional and overflow-free", async ({ page }) => {
  const widths = [360, 375, 390, 430, 768, 820, 1024, 1180, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("region", { name: "Provenance text scanner" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("public surfaces have main landmarks and no horizontal overflow across launch widths", async ({ page }) => {
  test.setTimeout(120_000);
  const widths = [375, 768, 1440];
  const routes = ["/", "/pricing", "/auth", "/contact", "/privacy-policy", "/terms-of-service", "/cookie-policy", "/faq", "/how-it-works", "/capabilities", "/mission"];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should be a public route`).toBeLessThan(400);
      await expect(page.locator("main").first(), `${route} should expose a main landmark`).toBeVisible();
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
