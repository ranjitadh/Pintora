import { expect, test } from "@playwright/test";

test.describe("studio pro tools", () => {
  test("empty state, alignment, layer controls and keyboard shortcuts", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/editor/ceramic-mug");
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Your print area is empty")).toBeVisible();

    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    await page.getByPlaceholder("Your words here").fill("Pro Tools");
    await page.getByRole("button", { name: "Add to canvas" }).click();

    await expect(page.getByRole("button", { name: "Center horizontally" })).toBeVisible();
    await page.getByRole("button", { name: "Center horizontally" }).click();
    await page.getByRole("button", { name: "Center vertically" }).click();

    await page.getByRole("button", { name: "Layers", exact: true }).first().click();
    await expect(page.getByText(/1 objects/)).toBeVisible();
    await page.getByRole("button", { name: "Hide layer" }).click();
    await expect(page.getByRole("button", { name: "Show layer" })).toBeVisible();
    await page.getByRole("button", { name: "Show layer" }).click();
    await page.getByRole("button", { name: "Lock layer" }).click();
    await expect(page.getByRole("button", { name: "Unlock layer" })).toBeVisible();
    await page.getByRole("button", { name: "Unlock layer" }).click();

    const canvas = page.locator(".editor-canvas canvas.upper-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.keyboard.press("Control+d");
    await expect(page.getByText(/2 objects/)).toBeVisible();
    await page.keyboard.press("Delete");
    await expect(page.getByText(/1 objects/)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
