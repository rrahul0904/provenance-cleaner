import { describe, expect, it } from "vitest";
import { isConfiguredAdminOwnerEmail, isConfiguredSupportEmail } from "@/lib/server/env";

describe("production email readiness", () => {
  it("requires a legitimate, non-placeholder support address", () => {
    expect(isConfiguredSupportEmail(undefined)).toBe(false);
    expect(isConfiguredSupportEmail("support@example.invalid")).toBe(false);
    expect(isConfiguredSupportEmail("support@example.com")).toBe(false);
    expect(isConfiguredSupportEmail("placeholder@company.test")).toBe(false);
    expect(isConfiguredSupportEmail("support@provenancecleaner.com")).toBe(true);
  });

  it("accepts only a legitimate owner bootstrap email", () => {
    expect(isConfiguredAdminOwnerEmail(undefined)).toBe(false);
    expect(isConfiguredAdminOwnerEmail("owner@example.com")).toBe(false);
    expect(isConfiguredAdminOwnerEmail("placeholder@company.test")).toBe(false);
    expect(isConfiguredAdminOwnerEmail("owner@provenancecleaner.com")).toBe(true);
  });
});
