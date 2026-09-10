import { describe, expect, it } from "vitest";
import { isConfiguredAdminOwnerEmail, isConfiguredSupportEmail, readinessChecks } from "@/lib/server/env";

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

  it("treats owner bootstrap configuration as optional after database provisioning", () => {
    const originalId = process.env.ADMIN_OWNER_USER_ID;
    const originalEmail = process.env.ADMIN_OWNER_EMAIL;
    delete process.env.ADMIN_OWNER_USER_ID;
    delete process.env.ADMIN_OWNER_EMAIL;

    try {
      const check = readinessChecks().adminOwnerBootstrap;
      expect(check).toEqual({ configured: false, required: false });
    } finally {
      if (originalId === undefined) delete process.env.ADMIN_OWNER_USER_ID;
      else process.env.ADMIN_OWNER_USER_ID = originalId;
      if (originalEmail === undefined) delete process.env.ADMIN_OWNER_EMAIL;
      else process.env.ADMIN_OWNER_EMAIL = originalEmail;
    }
  });
});
