import { describe, expect, it } from "vitest";
import { isConfiguredSupportEmail } from "@/lib/server/env";

describe("production support email readiness", () => {
  it("requires a legitimate, non-placeholder support address", () => {
    expect(isConfiguredSupportEmail(undefined)).toBe(false);
    expect(isConfiguredSupportEmail("support@example.invalid")).toBe(false);
    expect(isConfiguredSupportEmail("support@example.com")).toBe(false);
    expect(isConfiguredSupportEmail("placeholder@company.test")).toBe(false);
    expect(isConfiguredSupportEmail("support@provenancecleaner.com")).toBe(true);
  });
});
