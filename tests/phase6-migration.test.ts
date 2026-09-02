import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fifo = readFileSync("supabase/migrations/20260901184500_phase6_fifo_privacy.sql", "utf8");
const deletion = readFileSync("supabase/migrations/20260901185200_phase6_deletion_reconciliation.sql", "utf8");
const recovery = readFileSync("supabase/migrations/20260902034500_phase6_deletion_recovery.sql", "utf8");
const readiness = readFileSync("src/app/api/readiness/route.ts", "utf8");
const accountDelete = readFileSync("src/app/api/account/delete/route.ts", "utf8");

function securityDefinerBlocks(sql: string) {
  return sql.split(/create or replace function/iu).slice(1).filter(block => /security definer/iu.test(block));
}

describe("Phase 6 migration safety contract", () => {
  it("keeps FIFO credit consumption ordered by oldest lot", () => {
    expect(fifo).toMatch(/from billing\.credit_lots[\s\S]*where user_id = p_user_id and credits_remaining > 0[\s\S]*order by created_at, id[\s\S]*for update/iu);
    expect(fifo).toContain("billing.credit_consumptions");
    expect(fifo).toContain("credits_remaining = credits_remaining - v_take");
  });

  it("derives customer refunds from the remaining credits of that purchase lot", () => {
    expect(fifo).toMatch(/select \* into v_lot from billing\.credit_lots where purchase_id=p_purchase_id/iu);
    expect(fifo).toMatch(/'refundableCredits',coalesce\(v_lot\.credits_remaining,0\)/iu);
    expect(fifo).toMatch(/update billing\.credit_lots set credits_remaining=credits_remaining-p_credits where purchase_id=p_purchase_id/iu);
    expect(fifo).toContain("'refund_quote_changed'");
  });

  it("retains promo abuse prevention independently from user identity", () => {
    expect(fifo).toMatch(/create table if not exists billing\.promo_claims[\s\S]*email_fingerprint text primary key/iu);
    const promoTable = fifo.match(/create table if not exists billing\.promo_claims[\s\S]*?\);/iu)?.[0] ?? "";
    expect(promoTable).not.toMatch(/user_id|auth_user_id|email\s+text/iu);
  });

  it("keeps operational job history free of filenames and raw content columns", () => {
    const jobTable = fifo.match(/create table if not exists billing\.job_history[\s\S]*?\);/iu)?.[0] ?? "";
    expect(jobTable).toContain("size_bucket");
    expect(jobTable).not.toMatch(/filename|file_name|raw_text|source_text|result_text|content\s+text/iu);
  });

  it("uses controlled search paths for every SECURITY DEFINER function", () => {
    for (const block of [...securityDefinerBlocks(fifo), ...securityDefinerBlocks(deletion), ...securityDefinerBlocks(recovery)]) {
      expect(block).toMatch(/set search_path = ''/iu);
    }
  });

  it("does not grant Phase 6 RPC execution to browser roles", () => {
    for (const sql of [fifo, deletion, recovery]) {
      expect(sql).not.toMatch(/grant execute on function[\s\S]*?to\s+(anon|authenticated)\b/iu);
    }
    expect(fifo).toMatch(/grant execute on function public\.billing_claim_signup_promo[\s\S]*to service_role/iu);
    expect(recovery).toMatch(/grant execute on function public\.billing_reconcile_deleted_subjects[\s\S]*to service_role/iu);
  });

  it("recovers both successful Auth deletion and stale failed deletion preparation", () => {
    expect(recovery).toMatch(/auth_user_id is null[\s\S]*deleted_at is null/iu);
    expect(recovery).toMatch(/auth_user_id is not null[\s\S]*deletion_requested_at <= now\(\) - interval '10 minutes'/iu);
    expect(recovery).toContain("'cancelled', v_cancelled");
    expect(recovery).toContain("'deletionFailureRecovery', true");
  });

  it("makes the latest recovery migration mandatory for readiness and deletion", () => {
    expect(recovery).toContain("'schemaVersion', '20260902034500'");
    expect(recovery).toMatch(/'ready', v_mismatches = 0 and v_finalize_pending = 0 and v_stale_cancel_pending = 0/iu);
    expect(readiness).toContain('const REQUIRED_PHASE6_SCHEMA = "20260902034500"');
    expect(accountDelete).toContain('const REQUIRED_PHASE6_SCHEMA="20260902034500"');
  });
});
