import { expect, test } from "@playwright/test";
import { MAX_FILE_BYTES, MAX_REWRITE_WORDS } from "../../src/lib/product-contract";

function pngChunk(type: string, data: Uint8Array = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, Buffer.alloc(4)]);
}
function pngOfSize(size: number) {
  if (size < 32) throw new Error("PNG fixture size is too small");
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk("ruSt", Buffer.alloc(size - 32)), pngChunk("IEND")]);
}

async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See what your content is carrying/i })).toBeVisible();
}

test("free TXT scan creates no guest and the first clean bills by source words", async ({ page }) => {
  let guestCalls = 0;
  let sanitizeCalls = 0;
  const source = Array.from({ length: 1001 }, (_, index) => index === 0 ? "word\u200B" : "word").join(" ");
  const cleaned = source.replace("\u200B", "");

  await page.route("**/api/auth/anonymous", async route => {
    guestCalls += 1;
    const body = route.request().postDataJSON() as { forClean?: boolean };
    expect(body.forClean).toBe(true);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000020", isAnonymous: true, guestPromoGranted: true, balance: { settled: 2, held: 0, available: 2 } }) });
  });
  await page.route("**/api/text/sanitize", async route => {
    sanitizeCalls += 1;
    const body = route.request().postDataJSON() as { text: string; kind: string; operationId: string };
    expect(body.kind).toBe("txt");
    expect(body.text).toBe(source);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sanitation: { mode: "conservative", removed: [{ id: "txt-safe", category: "zero_width", disposition: "safe_remove", index: 4, codePoint: "U+200B", characterName: "ZERO WIDTH SPACE", description: "fixture" }], preservedForReview: [], output: cleaned }, verification: { safeRemovalsBefore: 1, safeRemovalsAfter: 0 }, billing: { operationId: body.operationId, reservationId: "00000000-0000-4000-8000-000000000021", creditsCharged: 2, balanceAfter: 0 } }) });
  });

  await open(page);
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  await scanner.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name: "boundary.txt", mimeType: "text/plain", buffer: Buffer.from(source) });
  await expect(scanner.getByText("TXT input")).toBeVisible();
  await scanner.getByRole("button", { name: /Scan text/ }).click();
  await expect(scanner.getByText(/1 finding/)).toBeVisible();
  expect(guestCalls).toBe(0);
  expect(sanitizeCalls).toBe(0);

  await expect(scanner.getByRole("button", { name: /Clean safe findings · 2 credits/ })).toBeEnabled();
  await scanner.getByRole("button", { name: /Clean safe findings · 2 credits/ }).click();
  await expect(scanner.getByText(/2 credits charged · 0 remaining/)).toBeVisible();
  expect(guestCalls).toBe(1);
  expect(sanitizeCalls).toBe(1);
});

test("file inspection accepts exactly the 3.2 MiB contract boundary and rejects one byte above before billing", async ({ page }) => {
  let guestCalls = 0;
  await page.route("**/api/auth/anonymous", route => { guestCalls += 1; return route.abort(); });
  await open(page);
  const region = page.getByRole("region", { name: "File metadata scanner" });
  const input = region.locator('input[type="file"]');

  for (const size of [MAX_FILE_BYTES - 1, MAX_FILE_BYTES]) {
    await input.setInputFiles({ name: `boundary-${size}.png`, mimeType: "image/png", buffer: pngOfSize(size) });
    await region.getByRole("button", { name: "Inspect file" }).click();
    await expect(region.getByText(/0 metadata findings/)).toBeVisible();
  }

  await input.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: pngOfSize(MAX_FILE_BYTES + 1) });
  await region.getByRole("button", { name: "Inspect file" }).click();
  await expect(region.getByText(/limited to 3\.2 MB/i)).toBeVisible();
  expect(guestCalls).toBe(0);
});

test("rewrite UI enforces 7,999 / 8,000 / 8,001 words and whitespace before any API call", async ({ page }) => {
  let transformCalls = 0;
  await page.route("**/api/transform", route => { transformCalls += 1; return route.abort(); });
  await open(page);
  const editor = page.getByRole("region", { name: "Semantics-preserving editor" });
  const textarea = editor.locator("textarea");
  const button = editor.getByRole("button", { name: /Edit for parity/i });

  for (const words of [MAX_REWRITE_WORDS - 1, MAX_REWRITE_WORDS]) {
    await textarea.fill(Array.from({ length: words }, () => "w").join(" "));
    await expect(editor.getByText(new RegExp(`${words.toLocaleString()} / ${MAX_REWRITE_WORDS.toLocaleString()} words`))).toBeVisible();
    await expect(button).toBeEnabled();
  }

  await textarea.fill(Array.from({ length: MAX_REWRITE_WORDS + 1 }, () => "w").join(" "));
  await expect(editor.getByText(/This edit is 8,001 words/)).toBeVisible();
  await expect(button).toBeDisabled();

  await textarea.fill("                    ");
  await expect(button).toBeDisabled();
  expect(transformCalls).toBe(0);
});
