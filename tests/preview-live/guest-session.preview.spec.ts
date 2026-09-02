import { expect, test, type Page } from "@playwright/test";

const PREVIEW_AUTH_BLOCKER = "BLOCKED — Vercel Preview Authentication still intercepts the parity Preview.";
const EXPECTED_HEAD_SHA = process.env.EXPECTED_HEAD_SHA?.trim();

type BalancePayload = {
  balance?: { settled: number; held: number; available: number };
  isAnonymous?: boolean;
  error?: { code?: string; message?: string };
};

async function assertPreviewIsReachable(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const appHeading = page.getByRole("heading", { name: /See what your content is carrying/i });
  const vercelLogin = page.getByRole("heading", { name: /Log in to Vercel/i });
  const landing = await Promise.race([
    appHeading.waitFor({ state: "visible", timeout: 10_000 }).then(() => "app" as const).catch(() => null),
    vercelLogin.waitFor({ state: "visible", timeout: 10_000 }).then(() => "vercel" as const).catch(() => null),
  ]);
  if (landing === "vercel") throw new Error(PREVIEW_AUTH_BLOCKER);
  await expect(appHeading).toBeVisible({ timeout: 30_000 });
}

async function waitForExactHead(page: Page) {
  if (!EXPECTED_HEAD_SHA) return;
  await expect.poll(async () => {
    const response = await page.context().request.get(new URL("/api/health", page.url()).toString());
    if (!response.ok()) return null;
    const payload = await response.json() as { commitSha?: string | null };
    return payload.commitSha ?? null;
  }, { timeout: 180_000, intervals: [1_000, 2_000, 5_000, 10_000] }).toBe(EXPECTED_HEAD_SHA);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function readBalance(page: Page) {
  const response = await page.context().request.get(new URL("/api/billing/balance", page.url()).toString());
  let payload: BalancePayload = {};
  try { payload = await response.json() as BalancePayload; } catch { /* status is still authoritative */ }
  return { status: response.status(), payload };
}

test("real Preview: anonymous session persists into balance, reload and navigation", async ({ page }) => {
  await assertPreviewIsReachable(page);
  await waitForExactHead(page);

  const signedOutBalance = await readBalance(page);
  expect(signedOutBalance.status).toBe(401);

  const account = page.getByRole("region", { name: "Account and credits" });
  const startGuest = account.getByRole("button", { name: /Start guest/i });
  await expect(startGuest).toBeEnabled({ timeout: 30_000 });

  const guestResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/auth/anonymous") && response.request().method() === "POST");
  await startGuest.click();
  const guestResponse = await guestResponsePromise;
  expect(guestResponse.status()).toBe(200);
  const guestPayload = await guestResponse.json() as { userId?: string; isAnonymous?: boolean; balance?: { available?: number } };
  expect(guestPayload.userId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(guestPayload.isAnonymous).toBe(true);
  expect(guestPayload.balance?.available).toBe(0);

  const storedCookies = await page.context().cookies();
  const storedAuthCookies = storedCookies.filter(cookie => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  expect(storedAuthCookies.length).toBeGreaterThan(0);
  expect(storedAuthCookies.every(cookie => cookie.secure && cookie.path === "/")).toBe(true);

  const immediateBalance = await readBalance(page);
  expect(immediateBalance.status).toBe(200);
  expect(immediateBalance.payload.isAnonymous).toBe(true);
  expect(immediateBalance.payload.balance).toEqual({ settled: 0, held: 0, available: 0 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "Account and credits" }).getByText("Guest session")).toBeVisible({ timeout: 30_000 });
  const afterReload = await readBalance(page);
  expect(afterReload.status).toBe(200);
  expect(afterReload.payload.balance).toEqual({ settled: 0, held: 0, available: 0 });

  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  const afterNavigation = await readBalance(page);
  expect(afterNavigation.status).toBe(200);
  expect(afterNavigation.payload.isAnonymous).toBe(true);
  expect(afterNavigation.payload.balance).toEqual({ settled: 0, held: 0, available: 0 });
});
