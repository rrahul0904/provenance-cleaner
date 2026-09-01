import { creditCostForText as sharedCreditCostForText } from "@/lib/product-contract";

export const CREDIT_PACKS = {
  starter: { id: "starter", label: "Starter", credits: 10, priceUsd: 4.99 },
  plus: { id: "plus", label: "Plus", credits: 25, priceUsd: 9.99 },
  pro: { id: "pro", label: "Pro", credits: 100, priceUsd: 24.99 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function creditCostForText(text: string) {
  return sharedCreditCostForText(text);
}
