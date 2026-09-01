import { expect, test } from "@playwright/test";

function pngChunk(type: string, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, Buffer.alloc(4)]);
}
function pngWith(type: string, data: Buffer) { return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk(type, data), pngChunk("IEND")]); }

async function open(page: import("@playwright/test").Page) { await page.goto("/"); await expect(page.getByRole("heading", { name: /See what your content is carrying/i })).toBeVisible(); }

test("local Unicode scan and conservative clean remain available", async ({ page }) => {
  await open(page);
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByLabel("Text to scan").fill("Hello\u200B world");
  await scanner.getByRole("button", { name: "Scan text" }).click();
  await expect(scanner.getByText("1 finding")).toBeVisible();
  await scanner.getByRole("button", { name: "Clean safe findings" }).click();
  await expect(scanner.getByText(/1 removed/)).toBeVisible();
});

test("file metadata can be cleaned but provenance blocks destructive action", async ({ page }) => {
  await open(page);
  const fileRegion = page.getByRole("region", { name: "File metadata scanner" });
  const input = fileRegion.locator('input[type="file"]');
  await input.setInputFiles({ name: "metadata.png", mimeType: "image/png", buffer: pngWith("tEXt", Buffer.from("Author\0Example")) });
  await fileRegion.getByRole("button", { name: "Inspect file" }).click();
  await expect(fileRegion.getByText(/metadata finding/)).toBeVisible();
  await fileRegion.getByRole("button", { name: "Sanitize privacy metadata" }).click();
  await expect(fileRegion.getByText("Post-clean verification")).toBeVisible();

  await input.setInputFiles({ name: "signed.png", mimeType: "image/png", buffer: pngWith("caBX", Buffer.from("provenance")) });
  await fileRegion.getByRole("button", { name: "Inspect file" }).click();
  const blocked = fileRegion.getByRole("button", { name: "Sanitization blocked" });
  await expect(blocked).toBeDisabled();
});

test("semantic editor surfaces validated mock output without a real model call", async ({ page }) => {
  await page.route("**/api/transform", async route => {
    const body = route.request().postDataJSON();
    expect(body.challengeToken).toBe("dev-bypass");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "semantic-transform-v2", text: "The revised statement keeps 2026 unchanged.", mode: body.mode, model: "mock/model", attempts: 1, metrics: { sourceWords: 8, outputWords: 7, lengthRatio: 0.95, protectedTotal: 1, protectedPreserved: 1, longestSharedWordRun: 3, trigramOverlap: 0.4 }, warnings: [], billing: { operationId: body.operationId, reservationId: "00000000-0000-4000-8000-000000000001", creditsCharged: 1, balanceAfter: 4 }, requestId: "e2e-request" }) });
  });
  await open(page);
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  await editor.locator("textarea").fill("This statement was written in 2026 and should remain factually identical.");
  await expect(editor.getByTestId("turnstile-bypass")).toBeVisible();
  await editor.getByRole("button", { name: /Edit for natural/i }).click();
  await expect(editor.getByText("The revised statement keeps 2026 unchanged.")).toBeVisible();
  await expect(editor.getByText(/1 credit charged/)).toBeVisible();
});

test("semantic editor shows safe production errors", async ({ page }) => {
  await page.route("**/api/transform", route => route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: { code: "insufficient_credits", message: "Not enough credits are available for this edit.", requestId: "e2e" } }) }));
  await open(page);
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  await editor.locator("textarea").fill("This is a sufficiently long editing request that should trigger the mocked API.");
  await editor.getByRole("button", { name: /Edit for natural/i }).click();
  await expect(editor.getByText("Not enough credits are available for this edit.")).toBeVisible();
});

test("guest UX and Checkout do not mutate credits client-side", async ({ page }) => {
  await page.route("**/api/auth/anonymous", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000010", isAnonymous: true, balance: { settled: 5, held: 0, available: 5 }, requestId: "guest-e2e" }) }));
  await page.route("**/api/billing/checkout", async route => { const body = route.request().postDataJSON(); expect(body.packId).toBe("starter"); expect(body.challengeToken).toBe("dev-bypass"); await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "checkout_unavailable", message: "Checkout is not available.", requestId: "checkout-e2e" } }) }); });
  await open(page);
  const account = page.getByRole("region", { name: "Account and credits" });
  await account.getByRole("button", { name: "Start guest" }).click();
  await expect(account.getByText("Guest session")).toBeVisible();
  await expect(account.getByText(/5 available credits/)).toBeVisible();
  await account.getByRole("button", { name: "+10" }).click();
  await expect(account.getByText("Checkout is not available.")).toBeVisible();
  await expect(account.getByText(/5 available credits/)).toBeVisible();
});

test("security headers and readiness expose no secrets", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect(health.headers()["x-content-type-options"]).toBe("nosniff");
  expect(health.headers()["content-security-policy"]).toContain("wasm-unsafe-eval");
  expect(health.headers()["content-security-policy"]).toContain("challenges.cloudflare.com");
  const readiness = await request.get("/api/readiness");
  expect([200, 503]).toContain(readiness.status());
  const text = await readiness.text();
  expect(text).not.toContain("STRIPE_SECRET_KEY");
  expect(text).not.toContain("SUPABASE_SECRET_KEY");
});
