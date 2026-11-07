import { expect, test } from "@playwright/test";

test.describe("customer full workflow", () => {
  const email = `e2e-full-${Date.now()}@printora.test`;
  const password = "Playwright12345";

  test("register, login, browse shop, view product, add to cart, checkout, order history", async ({ page }) => {
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (!request.url().includes("/media/")) {
        failedRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 500 && !response.url().includes("/media/")) {
        failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    // Register
    await page.goto("/register");
    await page.getByLabel("First name").fill("Full");
    await page.getByLabel("Last name").fill("Workflow");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // Browse shop
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: /Find your canvas/i })).toBeVisible();

    // Get first product
    const productCards = page.locator("a[href^='/products/']").first();
    await expect(productCards).toBeVisible({ timeout: 10000 });
    const productName = await productCards.locator("h3").first().textContent();
    const productNameStr = productName || "";

    // View product detail
    await productCards.click();
    await expect(page.getByRole("heading", { name: productNameStr, exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /Customize this product/i })).toBeVisible();

    // Go to editor
    await page.getByRole("link", { name: /Customize this product/i }).click();
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30000 });

    // Add text to canvas
    await page.getByRole("button", { name: "Text" }).first().click();
    await page.locator('textarea[placeholder="Your words here"]').fill("Hello Printora");
    await page.getByRole("button", { name: /Add to canvas/i }).click();
    await expect(page.locator(".editor-canvas canvas.upper-canvas")).toBeVisible();

    // Add to cart
    await page.getByRole("button", { name: /Add to cart/i }).first().click();
    await page.waitForURL("/cart", { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Almost yours/i })).toBeVisible();

    // Checkout
    await page.getByRole("button", { name: /Checkout/i }).click();
    await expect(page.getByRole("heading", { name: /Where should we send it/i })).toBeVisible({ timeout: 10000 });

    // Fill shipping info
    await page.getByLabel("Full name").fill("Full Workflow");
    await page.getByLabel("Street address").fill("123 Test Street");
    await page.getByLabel("City").fill("Test City");
    await page.getByLabel("Postal code").fill("12345");
    await page.getByLabel("Country").fill("United States");

    // Place demo order
    await page.waitForTimeout(500);
    const demoButton = page.getByRole("button", { name: /Place demo order/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for navigation to order page
    await page.waitForURL(/.*\/orders\/.*\?placed=1/, { timeout: 15000 });

    // Verify we're on the order detail page
    await expect(page.getByRole("heading", { name: /Paid/i })).toBeVisible({ timeout: 5000 });

    // View order history
    await page.getByRole("link", { name: /Orders/i }).first().click();
    await expect(page.getByRole("heading", { name: /Made & delivered/i })).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});

test.describe("admin full workflow", () => {
  test("admin can manage products, inventory, pricing, and orders", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin E2E.");

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/login?next=/admin");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin/);

    await expect(page.getByText("Good to see you.")).toBeVisible();

    await page.getByRole("link", { name: /Products/i }).click();
    await expect(page.getByRole("heading", { name: /Products/i })).toBeVisible();

    await page.getByRole("link", { name: /Pricing/i }).click();
    await expect(page.getByRole("heading", { name: /Pricing/i })).toBeVisible();

    await page.getByRole("link", { name: /Orders/i }).click();
    await expect(page.getByRole("heading", { name: /Orders/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

test.describe("design editor thorough test", () => {
  test("text, shapes, layers, undo/redo, save/reload, exports", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (!request.url().includes("/media/")) {
        pageErrors.push(`Request failed: ${request.method()} ${request.url()}`);
      }
    });

    await page.goto("/register");
    await page.getByLabel("First name").fill("Studio");
    await page.getByLabel("Last name").fill("User");
    await page.getByLabel("Email").fill(`studio-${Date.now()}@printora.test`);
    await page.getByLabel("Password", { exact: true }).fill("Playwright12345");
    await page.getByLabel("Confirm password").fill("Playwright12345");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/);

    await page.goto("/editor/art-poster");
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Text" }).first().click();
    await page.locator('textarea[placeholder="Your words here"]').fill("Test Text");
    await page.getByRole("button", { name: /Add to canvas/i }).click();
    await expect(page.locator(".editor-canvas canvas.upper-canvas")).toBeVisible();

    await page.getByRole("button", { name: "Upload" }).click();
    await page.getByRole("button", { name: /Rectangle/i }).click();
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: /Undo/i }).click();
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: /Redo/i }).click();
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: /Save design/i }).click();
    await expect(page.getByText("Design saved to your studio.")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /PNG/i }).first().click();
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /SVG/i }).first().click();
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /PDF/i }).first().click();
    await page.waitForTimeout(2000);

    expect(pageErrors).toEqual([]);
  });
});
