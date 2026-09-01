import { expect, test, type Frame, type Page } from "@playwright/test";

const FIXTURE = `On August 31, 2026, Jane emailed team@example.com and said, "Ship the report by Friday." The reference is https://example.com/report and the total is 42 units.`;
const RELEASE_MARKER = "[[PROVENANCE_PREVIEW_RELEASE_SMOKE]] This controlled Preview request must release its reserved credit after the injected model failure.";

type Balance = { settled: number; held: number; available: number };

async function fillAcrossFrames(page: Page, selectors: string[], value: string, required = true) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const frames: Frame[] = page.frames();
    for (const frame of frames) {
      for (const selector of selectors) {
        const input = frame.locator(selector).first();
        if (await input.count()) {
          try {
            if (await input.isVisible()) {
              await input.fill(value);
              return true;
            }
          } catch {
            // The Checkout DOM may replace payment frames while loading; retry.
          }
        }
      }
    }
    await page.waitForTimeout(250);
  }
  if (required) throw new Error(`Could not find a visible Stripe Checkout input: ${selectors.join(", ")}`);
  return false;
}

async function clickSubmitAcrossFrames(page: Page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (const frame of page.frames()) {
      const candidates = [
        frame.getByRole("button", { name: /pay|purchase|complete/i }).first(),
        frame.locator('button[type="submit"]').first(),
      ];
      for (const candidate of candidates) {
        if (await candidate.count()) {
          try {
            if (await candidate.isVisible() && await candidate.isEnabled()) {
              await candidate.click();
              return;
            }
          } catch {
            // Checkout can re-render during payment-method initialization; retry.
          }
        }
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Could not find an enabled Stripe Checkout submit button.");
}

async function balance(page: Page): Promise<Balance> {
  const response = await page.context().request.get(new URL("/api/billing/balance", page.url()).toString());
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.balance as Balance;
}

test("real Preview: guest → Stripe TEST Checkout → AI commit → release → duplicate operation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See what your content is carrying/i })).toBeVisible();

  const account = page.getByRole("region", { name: "Account and credits" });
  const startGuest = account.getByRole("button", { name: "Start guest" });
  await expect(startGuest).toBeEnabled({ timeout: 30_000 });
  await startGuest.click();
  await expect(account.getByText("Guest session")).toBeVisible();
  await expect(account.getByText(/0 available credits/)).toBeVisible();
  expect(await balance(page)).toEqual({ settled: 0, held: 0, available: 0 });

  const starter = account.getByRole("button", { name: "+10", exact: true });
  await expect(starter).toBeEnabled({ timeout: 30_000 });
  await starter.click();
  await page.waitForURL(/checkout\.stripe\.com\//u, { timeout: 30_000 });

  await fillAcrossFrames(page, ['input[type="email"]', 'input[autocomplete="email"]'], `provenance-smoke+${Date.now()}@example.com`);
  await fillAcrossFrames(page, ['input[autocomplete="cc-number"]', 'input[name="cardNumber"]', 'input[placeholder*="1234"]'], "4242424242424242");
  await fillAcrossFrames(page, ['input[autocomplete="cc-exp"]', 'input[name="cardExpiry"]', 'input[placeholder*="MM"]'], "1234");
  await fillAcrossFrames(page, ['input[autocomplete="cc-csc"]', 'input[name="cardCvc"]', 'input[placeholder*="CVC"]'], "123");
  await fillAcrossFrames(page, ['input[autocomplete="postal-code"]', 'input[name="billingPostalCode"]', 'input[placeholder*="ZIP"]'], "10001", false);
  await clickSubmitAcrossFrames(page);

  await page.waitForURL(/checkout=success/u, { timeout: 60_000 });
  await expect(account.getByText(/10 available credits/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await balance(page)).available, { timeout: 30_000 }).toBe(10);

  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  const textarea = editor.locator("textarea");
  let committedOperationId: string | null = null;
  const capture = (request: import("@playwright/test").Request) => {
    if (!request.url().endsWith("/api/transform") || request.method() !== "POST") return;
    const body = request.postDataJSON() as { operationId?: string };
    if (body.operationId && !committedOperationId) committedOperationId = body.operationId;
  };
  page.on("request", capture);

  await textarea.fill(FIXTURE);
  const edit = editor.getByRole("button", { name: /Edit for natural/i });
  await expect(edit).toBeEnabled({ timeout: 30_000 });
  await edit.click();
  await expect(editor.getByText(/1 credit charged/)).toBeVisible({ timeout: 90_000 });
  await expect(editor.getByText(/9 remaining/)).toBeVisible();
  const output = editor.locator("pre");
  for (const protectedValue of ["August 31, 2026", "team@example.com", '"Ship the report by Friday."', "https://example.com/report", "42"]) {
    await expect(output).toContainText(protectedValue);
  }
  expect(committedOperationId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(await balance(page)).toEqual({ settled: 9, held: 0, available: 9 });

  await textarea.fill(RELEASE_MARKER);
  await expect(edit).toBeEnabled({ timeout: 30_000 });
  await edit.click();
  await expect(editor.getByText(/editing service is temporarily unavailable/i)).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await balance(page)).held, { timeout: 30_000 }).toBe(0);
  expect(await balance(page)).toEqual({ settled: 9, held: 0, available: 9 });

  const operationId = committedOperationId!;
  await textarea.fill(FIXTURE);
  await expect(edit).toBeEnabled({ timeout: 30_000 });
  await page.route("**/api/transform", async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.continue({ postData: JSON.stringify({ ...body, operationId }) });
  }, { times: 1 });
  await edit.click();
  await expect(editor.getByText(/already in progress or complete|already been used/i)).toBeVisible({ timeout: 30_000 });
  expect(await balance(page)).toEqual({ settled: 9, held: 0, available: 9 });

  page.off("request", capture);
});
