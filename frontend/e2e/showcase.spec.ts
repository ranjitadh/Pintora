import { expect, test } from "@playwright/test";

test.describe("product showcase slider", () => {
  const pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");
  });

  test("renders the initial showcase with slider, categories and vertical navigation", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Your design/ })).toBeVisible();
    await expect(page.getByText("Part of the product.")).toBeVisible();
    await expect(page.getByRole("button", { name: /T-shirt/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mug/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bag/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Phone case/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Card/i })).toBeVisible();

    await expect(page.getByTestId("slider-before")).toBeVisible();
    await expect(page.getByTestId("slider-after")).toBeVisible();
    await expect(page.getByText(/Flat artwork/)).toBeVisible();
    await expect(page.getByText(/With surface/)).toBeVisible();

    // Vertical navigation indicators present on desktop.
    await expect(page.getByRole("button", { name: /Go to slide 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Go to slide 4/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("switching product categories updates the preview, mockup and right-side content", async ({ page }) => {
    await expect(page.getByRole("button", { name: /T-shirt/i }).first()).toHaveClass(/border-clay/);

    await page.getByRole("button", { name: /Mug/i }).first().click();
    await expect(page.getByRole("button", { name: /Mug/i }).first()).toHaveClass(/bg-clay/);
    await expect(page.getByRole("heading", { name: /Your creativity/ })).toBeVisible();
    await expect(page.getByText(/Without limits/)).toBeVisible();

    await expect(page.getByTestId("slider-after")).toBeVisible();
    const after = page.getByTestId("slider-after");
    await expect(async () => {
      const src = await after.getAttribute("src");
      expect(src).toContain("ceramic-mug-wrap");
    }).toPass({ timeout: 5000 });

    await page.getByRole("button", { name: /Bag/i }).first().click();
    await expect(page.getByRole("heading", { name: /Every product/ })).toBeVisible();
    await expect(page.getByText(/Flexible print areas/)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("vertical slide navigation updates the right-side content", async ({ page }) => {
    await page.getByRole("button", { name: /Go to slide 4/i }).first().click();
    await expect(page.getByRole("heading", { name: /From design to/ })).toBeVisible();
    await expect(page.getByTestId("showcase").getByText(/production/)).toBeVisible();
    await expect(page.getByTestId("showcase").getByText(/Organized order management/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Go to slide 4/i }).first()).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Go to slide 2/i }).first().click();
    await expect(page.getByRole("heading", { name: /Your creativity/ })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("CTA buttons navigate to valid MerchPress pages", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Try the demo/i }).first()).toHaveAttribute("href", "/shop");

    await page.getByRole("button", { name: /Go to slide 4/i }).first().click();
    await expect(page.getByRole("link", { name: /Try the demo/i })).toHaveAttribute("href", "/designs");

    await page.getByRole("link", { name: /Try the demo/i }).click();
    await expect(page).toHaveURL(/\/designs/);
  });

  test("mobile layout stacks content and keeps the slider usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByTestId("slider-before")).toBeVisible();
    await expect(page.getByTestId("slider-after")).toBeVisible();

    // Category tabs remain present and scrollable on mobile.
    await expect(page.getByRole("button", { name: /Card/i }).first()).toBeVisible();

    // Vertical navigation indicators move below the preview on mobile.
    await expect(page.getByRole("button", { name: /Go to slide 1/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
