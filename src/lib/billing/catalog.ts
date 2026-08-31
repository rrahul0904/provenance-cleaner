export const CREDIT_PACKS = {
  starter: { id: "starter", label: "Starter", credits: 10 },
  plus: { id: "plus", label: "Plus", credits: 25 },
  pro: { id: "pro", label: "Pro", credits: 100 },
} as const;
export type CreditPackId = keyof typeof CREDIT_PACKS;
export function creditCostForText(text: string) {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 1000));
}
