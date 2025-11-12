import { test, expect } from "@playwright/test";

test.describe("Recommendations flow", () => {
  test("searches and displays up to 10 recommendations", async ({ page }) => {
    await page.goto("/");

    const input = page.getByRole("combobox", { name: /search title/i });
    await input.fill("Spirited Away");

    const option = page.getByRole("option", { name: /spirited away/i }).first();
    await option.waitFor({ state: "visible" });
    await option.click();

    await page.waitForResponse((response) =>
      response.url().includes("/api/recommendations") && response.status() === 200,
    );

    const cards = page.getByTestId("recommendation-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);
  });
});

