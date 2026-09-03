import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type DashboardData = {
  registeredUsers: number; anonymousGuests: number; newUsersToday: number; newUsers7d: number; newUsers30d: number;
  dau: number; wau: number; mau: number; jobsToday: number; successfulJobs: number; failedJobs: number;
  creditsOutstanding: number; creditsConsumed: number; testRefundsCents: number; activeSubscriptions: number;
  pastDueSubscriptions: number; costMicros: number; schemaVersion: string; generatedAt: string;
  costByProvider: Array<{ provider: string; amountMicros: number; source: string }>;
  daily: Array<{ date: string; registeredUsers: number; anonymousGuests: number; jobs: number; successes: number; failures: number; testGrossRevenueCents: number; testRefundsCents: number; costMicros: number }>;
};
const number = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);
export async function getAdminDashboard(days = 30): Promise<DashboardData> {
  const { data, error } = await createAdminClient().rpc("ops_admin_dashboard", { p_days: Math.max(1, Math.min(90, days)) });
  if (error) throw new Error("admin_metrics_unavailable");
  const value = (data ?? {}) as Json as Record<string, unknown>;
  const rows = Array.isArray(value.daily) ? value.daily : [];
  const providers = Array.isArray(value.costByProvider) ? value.costByProvider : [];
  const get = (key: string) => number(value[key]);
  return { registeredUsers:get("registeredUsers"),anonymousGuests:get("anonymousGuests"),newUsersToday:get("newUsersToday"),newUsers7d:get("newUsers7d"),newUsers30d:get("newUsers30d"),dau:get("dau"),wau:get("wau"),mau:get("mau"),jobsToday:get("jobsToday"),successfulJobs:get("successfulJobs"),failedJobs:get("failedJobs"),creditsOutstanding:get("creditsOutstanding"),creditsConsumed:get("creditsConsumed"),testRefundsCents:get("testRefundsCents"),activeSubscriptions:get("activeSubscriptions"),pastDueSubscriptions:get("pastDueSubscriptions"),costMicros:get("costMicros"),schemaVersion:String(value.schemaVersion ?? "pending"),generatedAt:String(value.generatedAt ?? new Date().toISOString()),costByProvider:providers.map((row)=>{const item=row as Record<string,unknown>;return{provider:String(item.provider??"Unknown"),amountMicros:number(item.amountMicros),source:String(item.source??"ESTIMATED")};}),daily:rows.map((row)=>{const item=row as Record<string,unknown>;return{date:String(item.date),registeredUsers:number(item.registeredUsers),anonymousGuests:number(item.anonymousGuests),jobs:number(item.jobs),successes:number(item.successes),failures:number(item.failures),testGrossRevenueCents:number(item.testGrossRevenueCents),testRefundsCents:number(item.testRefundsCents),costMicros:number(item.costMicros)};}) };
}
