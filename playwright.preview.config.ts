import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PREVIEW_URL?.trim();
if (!baseURL) throw new Error("PREVIEW_URL is required for the real controlled-launch smoke.");

export default defineConfig({
  testDir: "./tests/preview-live",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
