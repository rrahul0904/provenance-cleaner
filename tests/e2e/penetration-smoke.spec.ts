import { expect, test } from "@playwright/test";

test("auth callback rejects protocol-relative open redirects", async ({ request }) => {
  const response = await request.get("/auth/callback?next=%2F%2Fevil.example", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(response.status());
  const location = response.headers()["location"];
  expect(location).toBeTruthy();
  const redirected = new URL(location!, "http://127.0.0.1:3000");
  expect(["localhost", "127.0.0.1"]).toContain(redirected.hostname);
  expect(redirected.port).toBe("3000");
  expect(location).not.toContain("evil.example");
});

test("JSON mutation endpoints reject content-type confusion", async ({ request }) => {
  const response = await request.post("/api/auth/anonymous", {
    headers: {
      origin: "http://127.0.0.1:3000",
      "content-type": "text/plain",
    },
    data: "{}",
  });
  expect(response.status()).toBe(415);
  expect(await response.json()).toMatchObject({
    error: { code: "unsupported_media_type" },
  });
});

test("destructive account route does not expose a GET handler", async ({ request }) => {
  const response = await request.get("/api/account/delete");
  expect([404, 405]).toContain(response.status());
});

test("invalid request IDs are not reflected back to callers", async ({ request }) => {
  const supplied = "bad<script>alert(1)</script>";
  const response = await request.get("/api/health", {
    headers: { "x-request-id": supplied },
  });
  expect(response.status()).toBe(200);
  const reflected = response.headers()["x-request-id"];
  expect(reflected).toBeTruthy();
  expect(reflected).not.toBe(supplied);
  expect(reflected).toMatch(/^[0-9a-f-]{36}$/iu);
});

test("public responses carry anti-clickjacking and content-sniffing protections", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("scanner renders attacker-controlled HTML as text instead of executable markup", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __pcXss?: number }).__pcXss = 0; });
  await page.goto("/");
  const scanner = page.getByRole("region", { name: "Provenance text scanner" });
  const payload = '<img src=x onerror="window.__pcXss=1"> unsafe-looking text\u200B';
  await scanner.getByLabel("Text to scan").fill(payload);
  await scanner.getByRole("button", { name: "Scan text" }).click();
  await expect(scanner.getByText(/finding/i).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pcXss?: number }).__pcXss)).toBe(0);
  await expect(scanner.locator('img[src="x"]')).toHaveCount(0);
});

test("public API does not opt into wildcard cross-origin reads", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { origin: "https://attacker.invalid" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).not.toBe("*");
});
