export type CostSource = "ACTUAL" | "ESTIMATED" | "MANUAL" | "CONFIRMED_ZERO";
export type ProviderCost = { provider: string; amountMicros: number; source: CostSource; units?: number };

export function microsToCents(micros: number) { return Math.round(micros / 10_000); }
export function sumMicros(costs: ReadonlyArray<ProviderCost>) { return costs.reduce((sum, cost) => sum + Math.max(0, Math.trunc(cost.amountMicros)), 0); }
export function budgetStatus(spendMicros: number, budgetMicros: number, warningPercent = 75, criticalPercent = 90) {
  if (budgetMicros <= 0) return "pending" as const;
  const percent = (spendMicros * 100) / budgetMicros;
  if (percent >= 100) return "critical" as const;
  if (percent >= criticalPercent) return "critical" as const;
  if (percent >= warningPercent) return "warning" as const;
  return "healthy" as const;
}
export function projectedMonthEndMicros(monthToDateMicros: number, elapsedDays: number, daysInMonth: number) {
  if (elapsedDays <= 0 || daysInMonth <= 0) return 0;
  return Math.round((monthToDateMicros / elapsedDays) * daysInMonth);
}
export function contributionMargin(netRevenueCents: number, variableCostMicros: number) {
  const costCents = microsToCents(variableCostMicros);
  const contributionCents = netRevenueCents - costCents;
  return { contributionCents, percent: netRevenueCents > 0 ? Math.round((contributionCents * 10_000) / netRevenueCents) / 100 : null };
}
export function costCoverage(providers: ReadonlyArray<{ source: CostSource | null }>) {
  if (providers.length === 0) return 0;
  return Math.round((providers.filter((provider) => provider.source !== null).length / providers.length) * 100);
}
