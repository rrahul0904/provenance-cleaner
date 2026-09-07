import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allows, canManageAdminUsers, canMutateOperations } from "@/lib/admin/permissions";
import { budgetStatus, contributionMargin, costCoverage, microsToCents, projectedMonthEndMicros, sumMicros } from "@/lib/admin/finops";
import { csvCell } from "@/lib/admin/csv";
import { SUBSCRIPTION_PLANS, subscriptionInvoiceSourceKey, subscriptionMonthlyMrrCents } from "@/lib/billing/subscriptions";

const migration = readFileSync("supabase/migrations/20260903144643_phase7_admin_finops_subscriptions.sql", "utf8");

describe("Phase 7 admin, subscription, and FinOps contracts", () => {
  it("enforces owner/admin/viewer authority without a client role", () => {
    expect(allows("viewer", "viewer")).toBe(true);
    expect(allows("viewer", "admin")).toBe(false);
    expect(canMutateOperations("viewer")).toBe(false);
    expect(canMutateOperations("admin")).toBe(true);
    expect(canManageAdminUsers("admin")).toBe(false);
    expect(canManageAdminUsers("owner")).toBe(true);
  });

  it("uses integer minor-unit/micro arithmetic and explicit budget states", () => {
    expect(microsToCents(19_999)).toBe(2);
    expect(sumMicros([{ provider: "AI", amountMicros: 125, source: "ACTUAL" }, { provider: "Stripe", amountMicros: 75, source: "ESTIMATED" }])).toBe(200);
    expect(projectedMonthEndMicros(1_000, 5, 30)).toBe(6_000);
    expect(budgetStatus(74, 100)).toBe("healthy");
    expect(budgetStatus(75, 100)).toBe("warning");
    expect(budgetStatus(90, 100)).toBe("critical");
    expect(contributionMargin(1_000, 1_250_000)).toEqual({ contributionCents: 875, percent: 87.5 });
    expect(costCoverage([{ source: "ACTUAL" }, { source: "CONFIRMED_ZERO" }, { source: null }])).toBe(67);
  });

  it("keeps recurring economics explicit and invoice grants idempotent by invoice", () => {
    expect(SUBSCRIPTION_PLANS.plus_monthly).toMatchObject({ monthlyCents: 999, credits: 30 });
    expect(subscriptionMonthlyMrrCents([{ status: "active", planId: "plus_monthly" }, { status: "past_due", planId: "studio_monthly" }])).toBe(999);
    expect(subscriptionInvoiceSourceKey("in_123ABC")).toBe("subscription_invoice:in_123ABC");
    expect(() => subscriptionInvoiceSourceKey("invoice")).toThrow(/invalid/i);
  });

  it("prevents formula injection in admin CSV exports", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(csvCell("normal")).toBe("\"normal\"");
  });

  it("keeps private operational tables and browser roles denied", () => {
    for (const table of ["ops.admin_users", "ops.admin_audit_log", "ops.metric_events", "ops.cost_events", "billing.subscriptions", "billing.subscription_period_grants"]) expect(migration).toContain(table);
    expect(migration).toMatch(/revoke all on all tables in schema ops from public, anon, authenticated/iu);
    expect(migration).toMatch(/grant execute on function[\s\S]*public\.billing_grant_subscription_invoice[\s\S]*to service_role/iu);
    expect(migration).not.toMatch(/grant execute on function[\s\S]*?to\s+(anon|authenticated)\b/iu);
  });

  it("keeps privacy-sensitive payload columns out of metrics and audit tables", () => {
    for (const table of ["ops.metric_events", "ops.admin_audit_log", "ops.cost_events"]) {
      const block = migration.match(new RegExp(`create table if not exists ${table.replace(".", "\\.")}[\\s\\S]*?\\);`, "iu"))?.[0] ?? "";
      expect(block).not.toMatch(/raw_text|source_text|result_text|filename|file_bytes|prompt\s+text/iu);
    }
  });
});
