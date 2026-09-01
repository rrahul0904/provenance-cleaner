import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PREVIEW_URL?.trim();
if (!baseURL) throw new Error("PREVIEW_URL is required for the real controlled-launch smoke.");
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

export default defineConfig({
  testDir: "./tests/preview-live",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    // This is supplied only by the explicitly triggered release workflow and
    // is never persisted in the repository or Playwright artifacts.
    ...(protectionBypass ? { extraHTTPHeaders: { "x-vercel-protection-bypass": protectionBypass } } : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
