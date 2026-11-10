import { expect, test } from "@playwright/test";

test.describe("theme and assistant fixes", () => {
  test("dark mode restyles shared surfaces and persists after reload", async ({ page }) => {
    await page.goto("/");

    const card = page.locator(".card").first();
    await expect(card).toBeVisible();
    const lightCard = await card.evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.getByRole("button", { name: "Switch to dark mode" }).first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect
      .poll(async () => card.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(lightCard);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("shop category labels and promo surface adapt to dark mode", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: "Switch to dark mode" }).first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const category = page.getByRole("button", { name: /^Bags/ });
    await expect(category).toBeVisible();
    await expect
      .poll(async () => {
        const color = await category.evaluate((element) => getComputedStyle(element).color);
        const [red, green, blue] = color.match(/[\d.]+/g)!.map(Number);
        return red + green + blue;
      })
      .toBeGreaterThan(400);

    const promo = page.locator("aside .bg-olive-soft");
    await expect(promo).toBeVisible();
    await expect
      .poll(async () => {
        const background = await promo.evaluate((element) => getComputedStyle(element).backgroundColor);
        const [red, green, blue] = background.match(/[\d.]+/g)!.map(Number);
        return red + green + blue;
      })
      .toBeLessThan(200);
  });

  test("assistant unread badge increments while closed and clears when opened", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/assistant/chat/", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "A delayed assistant reply." }),
      });
    });

    await page.getByRole("button", { name: "Open chat" }).click();
    const input = page.getByPlaceholder("Type a message…");
    await input.fill("Hello");
    await input.press("Enter");
    await page.getByRole("button", { name: "Close chat" }).click();

    const toggle = page.getByRole("button", { name: "Open chat" });
    await expect(toggle).toContainText("1");

    await toggle.click();
    await expect(page.getByRole("button", { name: "Close chat" })).not.toContainText("1");
  });
});
