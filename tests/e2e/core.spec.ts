import { expect, test } from "@playwright/test";

function pngChunk(type: string, data: Uint8Array = Buffer.alloc(0)) { const typeBytes = Buffer.from(type, "ascii"); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); return Buffer.concat([length, typeBytes, data, Buffer.alloc(4)]); }
function pngHeader() { return pngChunk("IHDR", Buffer.from([0,0,0,1,0,0,0,1,8,6,0,0,0])); }
function pngWith(type: string, data: Uint8Array) { return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngHeader(), pngChunk(type, data), pngChunk("IEND")]); }
function cleanPng() { return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngHeader(), pngChunk("IEND")]); }
async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Know what your content is carrying/i })).toBeVisible();
}
async function selectMode(page: import("@playwright/test").Page, mode: "Text" | "Files" | "Rewrite" | "Artifacts") {
  const tab = page.getByRole("tab", { name: new RegExp(`^${mode}`, "i") });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}
async function mockGuestPromo(page: import("@playwright/test").Page, available = 2) { await page.route("**/api/auth/anonymous", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000010", isAnonymous: true, balance: { settled: available, held: 0, available }, guestPromoGranted: true, requestId: "guest-e2e" }) })); }

function mockTransformResult(body: { operationId: string; mode: string; intensity?: string; purpose?: string; text?: string; lockedSpans?: Array<{ start: number; end: number }> }) {
  const lockedRanges = body.lockedSpans ?? [];
  const lockedText = lockedRanges.map(({ start, end }) => body.text?.slice(start, end) ?? "");
  const lockedCount = lockedRanges.length;
  return { version: "semantic-transform-v2", text: `The revised statement keeps 2026 unchanged.${lockedText.length ? ` ${lockedText.join(" ")}` : ""}`, mode: body.mode, intensity: body.intensity ?? "balanced", purpose: body.purpose ?? "general", model: "mock/model", attempts: 1, metrics: { sourceWords: 8, outputWords: 7, lengthRatio: 0.95, retainedPercent: 95, wordingReplacedPercent: 55, protectedTotal: 1 + lockedCount, protectedPreserved: 1 + lockedCount, longestSharedWordRun: 3, trigramOverlap: 0.4, unprotectedLongestSharedWordRun: 2 }, receipt: { sourceWords: 8, outputWords: 7, retainedPercent: 95, wordingReplacedPercent: 55, longestUnprotectedSharedWordRun: 2, protectedSpanCount: 1 + lockedCount, checks: { protectedSpansPreserved: true, numericDateEntityExpected: 1, numericDateEntityPreserved: 1, quoteReferenceExpected: 0, quoteReferencePreserved: 0, userLockedSpanExpected: lockedCount, userLockedSpanPreserved: lockedCount }, model: "mock/model", attempts: 1, creditsCharged: 1 }, watermark: { available: false, status: "unavailable", note: "No verifier configured." }, warnings: [], billing: { operationId: body.operationId, reservationId: "00000000-0000-4000-8000-000000000001", creditsCharged: 1, balanceAfter: 4 }, requestId: "e2e-request" };
}

test("free Unicode scan stays local while conservative cleaning is billable", async ({ page }) => {
  await mockGuestPromo(page, 2);
  await page.route("**/api/text/sanitize", async route => { const body = route.request().postDataJSON(); expect(body.text).toBe("Hello\u200B world"); expect(body.kind).toBe("text"); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sanitation: { mode: "conservative", removed: [{ id: "u-5-200b", category: "zero_width", disposition: "safe_remove", index: 5, codePoint: "U+200B", characterName: "ZERO WIDTH SPACE", description: "test" }], preservedForReview: [], output: "Hello world" }, verification: { safeRemovalsBefore: 1, safeRemovalsAfter: 0 }, billing: { operationId: body.operationId, reservationId: "00000000-0000-4000-8000-000000000001", creditsCharged: 1, balanceAfter: 1 }, requestId: "text-clean-e2e" }) }); });
  await open(page); const scanner = page.getByRole("region", { name: "Provenance text scanner" }); const textInput = scanner.getByLabel("Text to scan"); await textInput.fill(""); await textInput.fill("Hello\u200B world"); await expect(textInput).toHaveValue("Hello\u200B world"); await scanner.getByRole("button", { name: "Scan text" }).click(); await expect(scanner.getByText("1 finding")).toBeVisible(); await scanner.getByRole("button", { name: /Clean safe findings/ }).click(); await expect(scanner.getByText(/1 removed/)).toBeVisible(); await expect(scanner.getByText(/1 credit charged · 1 remaining/)).toBeVisible();
});

test("non-printing controls are review findings and are not silently cleaned", async ({ page }) => {
  await open(page);
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.getByRole("button", { name: "Try example" }).click();
  const textInput = scanner.getByLabel("Text to scan");
  await textInput.fill("alpha\u0090omega");
  await expect(textInput).toHaveValue("alpha\u0090omega");
  await scanner.getByRole("button", { name: "Scan text — free" }).click();
  await expect(scanner.getByRole("heading", { name: "1 finding" })).toBeVisible();
  await expect(scanner.getByText("0 safe removals · 1 item to review")).toBeVisible();
  await expect(scanner.getByRole("button", { name: /U\+0090 C1 CONTROL/ })).toBeVisible();
});

test("malformed image structure is rejected during local file inspection", async ({ page }) => {
  await open(page);
  await selectMode(page, "Files");
  const fileRegion = page.getByRole("region", { name: "File metadata scanner" });
  const input = fileRegion.locator('input[type="file"]');
  await input.setInputFiles({ name: "truncated.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await fileRegion.getByRole("button", { name: "Inspect file" }).click();
  await expect(fileRegion.getByText(/Invalid PNG structure/)).toBeVisible();
  await expect(fileRegion.getByRole("button", { name: "Sanitize privacy metadata · 1 unit" })).toBeDisabled();
});

test("file metadata cleaning is server-authoritative and provenance blocks destructive action", async ({ page }) => {
  await mockGuestPromo(page, 2); await page.route("**/api/files/sanitize", async route => { expect(route.request().headers()["x-file-name"]).toContain("metadata.png"); await route.fulfill({ status: 200, body: cleanPng(), headers: { "content-type": "image/png", "x-output-file-name": encodeURIComponent("metadata.clean.png"), "x-credits-charged": "1", "x-balance-after": "1", "x-input-kind": "png", "x-removed-count": "1" } }); });
  await open(page); await selectMode(page, "Files"); const fileRegion = page.getByRole("region", { name: "File metadata scanner" }); const input = fileRegion.locator('input[type="file"]'); await input.setInputFiles({ name: "metadata.png", mimeType: "image/png", buffer: pngWith("tEXt", Buffer.from("Author\0Example")) }); await fileRegion.getByRole("button", { name: "Inspect file" }).click(); await expect(fileRegion.getByText(/metadata finding/)).toBeVisible(); await fileRegion.getByRole("button", { name: /Sanitize privacy metadata/ }).click(); await expect(fileRegion.getByText("Before / after metadata")).toBeVisible(); await expect(fileRegion.getByText(/1 credit charged · 1 remaining/)).toBeVisible(); await input.setInputFiles({ name: "signed.png", mimeType: "image/png", buffer: pngWith("caBX", Buffer.from("provenance")) }); await fileRegion.getByRole("button", { name: "Inspect file" }).click(); await expect(fileRegion.getByRole("button", { name: "Sanitization blocked" })).toBeDisabled();
});

test("semantic editor surfaces validated mock output without a real model call", async ({ page }) => {
  await page.route("**/api/transform", async route => { const body = route.request().postDataJSON(); expect(body.challengeToken).toBe("dev-bypass"); expect(body.mode).toBe("parity"); expect(body.intensity).toBe("balanced"); expect(body.purpose).toBe("general"); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockTransformResult(body)) }); });
  await open(page); await selectMode(page, "Rewrite"); const editor = page.getByRole("region", { name: "Semantics-preserving editor" }); await editor.getByRole("textbox", { name: "Source text for protected semantic editing" }).fill("This statement was written in 2026 and should remain factually identical."); await expect(editor.getByTestId("turnstile-bypass")).toBeVisible(); await editor.getByRole("button", { name: /Edit for parity/i }).click(); await expect(editor.locator(".clean-output pre")).toHaveText("The revised statement keeps 2026 unchanged."); await expect(editor.getByText("1 unit committed", { exact: true })).toBeVisible(); await expect(editor.getByText(/Text-watermark verifier: unavailable/)).toBeVisible();
});

test("writer-selected passages are locked and included in the verified edit receipt", async ({ page }) => {
  const source = "The customer code CUSTOM-ALPHA stays exactly as provided while other wording changes.";
  const start = source.indexOf("CUSTOM-ALPHA");
  await page.route("**/api/transform", async route => {
    const body = route.request().postDataJSON();
    expect(body.lockedSpans).toEqual([{ start, end: start + "CUSTOM-ALPHA".length }]);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockTransformResult(body)) });
  });
  await open(page);
  await selectMode(page, "Rewrite");
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  const input = editor.getByRole("textbox", { name: "Source text for protected semantic editing" });
  await input.fill(source);
  await input.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(18, 30));
  await editor.getByRole("button", { name: "Lock selected text" }).click();
  await expect(editor.getByText("1 passage locked")).toBeVisible();
  await editor.getByRole("button", { name: /Edit for parity/i }).click();
  await expect(editor.locator(".clean-output pre")).toContainText("CUSTOM-ALPHA");
  await expect(editor.getByText("locked 1/1")).toBeVisible();
  await editor.getByRole("button", { name: "Use as source" }).click();
  await expect(editor.getByText("1 passage locked")).toHaveCount(0);
});

test("semantic editor shows safe production errors", async ({ page }) => {
  await page.route("**/api/transform", route => route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: { code: "insufficient_credits", message: "Not enough credits are available for this edit.", requestId: "e2e" } }) })); await open(page); await selectMode(page, "Rewrite"); const editor = page.getByRole("region", { name: "Semantics-preserving editor" }); await editor.getByRole("textbox", { name: "Source text for protected semantic editing" }).fill("This is a sufficiently long editing request that should trigger the mocked API."); await editor.getByRole("button", { name: /Edit for parity/i }).click(); await expect(editor.getByText("Not enough credits are available for this edit.")).toBeVisible();
});

test("failed preservation validation enters NEEDS_REVIEW without applying output", async ({ page }) => {
  await page.route("**/api/transform", route => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "validation_failed", message: "The edit did not pass factual-preservation checks. The credit hold was released.", requestId: "e2e" } }) }));
  await open(page);
  await selectMode(page, "Rewrite");
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  const source = "Keep the source unchanged if the protected details cannot be verified.";
  const input = editor.getByRole("textbox", { name: "Source text for protected semantic editing" });
  await input.fill(source);
  await editor.getByRole("button", { name: /Edit for parity/i }).click();
  await expect(editor.getByText(/NEEDS_REVIEW/)).toBeVisible();
  await expect(editor.getByRole("alert")).toContainText("credit hold was released");
  await expect(input).toHaveValue(source);
  await expect(editor.getByRole("heading", { name: "Ready when you are" })).toBeVisible();
});

test("style balance provides local, bounded measurements without authorship labels", async ({ page }) => {
  await open(page);
  await selectMode(page, "Rewrite");
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  await editor.getByRole("textbox", { name: "Source text for protected semantic editing" }).fill(
    "We opened the workshop windows before arranging tools on the broad table. The shelves held paper, cloth, brushes, and jars of water. I checked each handle while my colleague sorted the supplies. Visitors chose seats near the windows and began sketching the quiet garden outside. We left the center of the room clear so everyone could move comfortably. A caretaker repaired the loose hinge before the afternoon group arrived.",
  );
  await editor.getByText("Style balance · local measurements").click();
  await editor.getByRole("button", { name: "Measure source locally" }).click();
  const measurements = editor.getByRole("table", { name: /Style measurements · style-balance-v1/ });
  await expect(measurements).toBeVisible();
  await expect(measurements.getByRole("cell", { name: "within range" }).first()).toBeVisible();
  await expect(editor.getByText(/do not determine authorship/i)).toBeVisible();
  await expect(measurements).not.toContainText(/\b(?:AI|human|detector)\b/i);
});

test("in-flight transform locks source edits until the verified response completes", async ({ page }) => {
  await page.route("**/api/transform", async route => { const body = route.request().postDataJSON(); await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockTransformResult(body)) }).catch(() => undefined); });
  await open(page); await selectMode(page, "Rewrite"); const editor = page.getByRole("region", { name: "Semantics-preserving editor" }); const textarea = editor.getByRole("textbox", { name: "Source text for protected semantic editing" }); await textarea.fill("This source sentence was written in 2026 and is long enough for editing."); await editor.getByRole("button", { name: /Edit for parity/i }).click(); await expect(textarea).toBeDisabled(); await expect(editor.locator(".clean-output pre")).toHaveText("The revised statement keeps 2026 unchanged."); await expect(textarea).toBeEnabled();
});


test("paid rewrite result survives switching away from and back to the workbench tab", async ({ page }) => {
  await page.route("**/api/transform", async route => {
    const body = route.request().postDataJSON();
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockTransformResult(body)) });
  });
  await open(page);
  await selectMode(page, "Rewrite");
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  await editor.getByRole("textbox", { name: "Source text for protected semantic editing" }).fill("This statement was written in 2026 and should remain factually identical.");
  await editor.getByRole("button", { name: /Edit for parity/i }).click();
  await selectMode(page, "Text");
  await page.waitForTimeout(350);
  await selectMode(page, "Rewrite");
  await expect(page.getByRole("region", { name: "Semantics-preserving editor" }).locator(".clean-output pre")).toHaveText("The revised statement keeps 2026 unchanged.");
});



test("local scan remains usable offline while server-authoritative actions are disabled", async ({ page }) => {
  await open(page);
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  // Click a hydrated client control before editing the controlled textarea.
  await scanner.getByRole("button", { name: "Try example" }).click();
  const textInput = scanner.getByLabel("Text to scan");
  await textInput.fill("Offline\u200B inspection remains local.");
  await expect(textInput).toHaveValue("Offline\u200B inspection remains local.");
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(scanner.getByText(/Offline · local inspection ready/)).toBeVisible();
  await scanner.getByRole("button", { name: "Scan text" }).click();
  await expect(scanner.getByText("1 finding")).toBeVisible();
  await expect(scanner.getByRole("button", { name: /Clean safe findings/ })).toBeDisabled();
  await expect(scanner.getByRole("button", { name: "Export JSON receipt" })).toBeEnabled();
});

test("artifact provenance creates and re-verifies a local integrity receipt", async ({ page }) => {
  await open(page);
  await selectMode(page, "Artifacts");
  const artifact = page.getByRole("region", { name: "Artifact provenance workbench" });
  await expect(artifact.getByRole("heading", { name: "Hash the artifact. Verify the receipt." })).toBeVisible();
  await artifact.getByRole("button", { name: "Generate local receipt" }).click();
  await expect(artifact.getByText("Receipt generated")).toBeVisible();
  await expect(artifact.getByText("Artifact SHA-256", { exact: true })).toBeVisible();
  await artifact.getByRole("button", { name: "Verify artifact + receipt" }).click();
  await expect(artifact.getByText("Integrity verified")).toBeVisible();
});

test("pricing pack buttons invoke one-time checkout directly instead of routing through account", async ({ page }) => {
  let checkoutCalls = 0;
  await page.route("**/api/billing/checkout", async route => {
    checkoutCalls += 1;
    const body = route.request().postDataJSON();
    expect(body.packId).toBe("starter");
    expect(body.challengeToken).toBe("dev-bypass");
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "checkout_unavailable", message: "Checkout is not available.", requestId: "pricing-e2e" } }) });
  });
  await page.goto("/pricing");
  const starter = page.getByRole("button", { name: "Buy Starter" });
  await expect(starter).toBeEnabled();
  await starter.click();
  await expect(page.getByText("Checkout is not available.", { exact: true })).toBeVisible();
  expect(checkoutCalls).toBe(1);
});

test("guest UX and Checkout do not mutate credits client-side", async ({ page }) => {
  await mockGuestPromo(page, 5); await page.route("**/api/billing/checkout", async route => { const body = route.request().postDataJSON(); expect(body.packId).toBe("starter"); expect(body.challengeToken).toBe("dev-bypass"); await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "checkout_unavailable", message: "Checkout is not available.", requestId: "checkout-e2e" } }) }); }); await open(page); const account = page.getByRole("region", { name: "Account and credits" }); await account.getByRole("button", { name: /Start guest/ }).click(); await expect(account.getByText("Guest session")).toBeVisible(); await expect(account.getByText(/5 available/)).toBeVisible(); await account.getByRole("button", { name: /\+10 · \$4\.99/ }).click(); await expect(account.getByText("Checkout is not available.")).toBeVisible(); await expect(account.getByText(/5 available/)).toBeVisible();
});

test("security headers and readiness expose no secrets", async ({ request }) => { const health = await request.get("/api/health"); expect(health.ok()).toBeTruthy(); expect(health.headers()["x-content-type-options"]).toBe("nosniff"); expect(health.headers()["content-security-policy"]).toContain("wasm-unsafe-eval"); expect(health.headers()["content-security-policy"]).toContain("challenges.cloudflare.com"); const readiness = await request.get("/api/readiness"); expect([200, 503]).toContain(readiness.status()); const text = await readiness.text(); expect(text).not.toContain("STRIPE_SECRET_KEY"); expect(text).not.toContain("SUPABASE_SECRET_KEY"); });
