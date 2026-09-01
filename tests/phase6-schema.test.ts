import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/20260901184500_phase6_fifo_privacy.sql", import.meta.url), "utf8");

describe("Phase 6 migration safety contract", () => {
  it("uses versioned FIFO lot accounting rather than the retired global approximation", () => {
    expect(migration).toContain("billing.credit_lots");
    expect(migration).toContain("billing.credit_consumptions");
    expect(migration).toContain("allocate_usage_fifo");
    expect(migration).not.toContain("v_total_usage - v_prior_positive");
  });

  it("detaches authentication identity without cascading deletion through the ledger", () => {
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("billing_prepare_account_deletion");
    expect(migration).toContain("on delete restrict");
    expect(migration).not.toContain("references auth.users(id) on delete cascade");
  });

  it("keeps anti-abuse, job history, reconciliation and readiness explicit", () => {
    expect(migration).toContain("billing.promo_claims");
    expect(migration).toContain("billing.job_history");
    expect(migration).toContain("billing_record_policy_refund");
    expect(migration).toContain("billing_phase6_status");
    expect(migration).not.toMatch(/file_?name\s+text/i);
  });

  it("locks public RPCs to service-role execution and controlled search paths", () => {
    expect(migration).toMatch(/security definer[\s\S]*?set search_path = ''/i);
    expect(migration).toContain("from public,anon,authenticated");
    expect(migration).toContain("to service_role");
  });
});
