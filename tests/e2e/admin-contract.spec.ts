import { expect, test } from "@playwright/test";

test("admin routes reject an anonymous browser server-side", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\?next=%2Fadmin|\/auth\?next=\/admin/);
  await expect(page.getByRole("heading", { name: /sign in|account/i })).toBeVisible();
});

test("pricing distinguishes monthly TEST plans from pay-as-you-go packs", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Predictable processing allowance.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add usage only when you need it.", exact: true })).toBeVisible();

  const studioMonthlyCard = page.locator("article.credit-pack-card").filter({ hasText: "MONTHLY PLAN" }).filter({ hasText: "Studio Monthly" });
  await expect(studioMonthlyCard).toHaveCount(1);
  await expect(studioMonthlyCard.getByRole("heading", { name: "Studio Monthly", exact: true })).toBeVisible();
});
