import { expect, test } from "@playwright/test";

test.describe("public storefront", () => {
  test("home page renders the primary call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Wear your/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Start designing/i }).first()).toBeVisible();
  });

  test("health endpoint reports a healthy API", async ({ request }) => {
    const response = await request.get("/api/health/");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("printora-api");
  });

  test("shop lists the seeded catalog", async ({ page, request }) => {
    const response = await request.get("/api/products/?sort=newest");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.results.length).toBeGreaterThan(0);

    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: /Find your canvas/i })).toBeVisible();
    await expect(page.getByText(payload.results[0].name).first()).toBeVisible();
  });

  test("product detail exposes the studio entry point", async ({ page, request }) => {
    const response = await request.get("/api/products/?sort=newest");
    const payload = await response.json();
    const slug = payload.results[0].slug;

    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("link", { name: /Customize this product/i })).toBeVisible();
  });

  test("studio loads for a product with stages", async ({ page, request }) => {
    const response = await request.get("/api/products/?sort=newest");
    const payload = await response.json();
    const slug = payload.results[0].slug;

    await page.goto(`/editor/${slug}`);
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("template text can be dragged on the canvas", async ({ page, request }) => {
    const templatesResponse = await request.get("/api/templates/");
    const templates = await templatesResponse.json();
    const template = templates.find((item: any) => item.slug === "mono-grid");
    expect(template).toBeTruthy();

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/editor/art-poster");
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Templates" }).first().click();
    await page.getByText(template.name, { exact: true }).click();

    const canvas = page.locator(".editor-canvas canvas.upper-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.5;
    const startY = box!.y + box!.height * 0.46;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY - 40, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByText("Unsaved changes")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});

test.describe("customer auth", () => {
  test("a new customer can register and reach the account page", async ({ page }) => {
    const email = `e2e-${Date.now()}@printora.test`;
    const firstName = "E2E";

    await page.goto("/register");
    await page.getByLabel("First name").fill(firstName);
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Playwright12345");
    await page.getByLabel("Confirm password").fill("Playwright12345");
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: `${firstName} Tester` })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});

test.describe("admin access", () => {
  test("admin area is protected when signed out", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Sign in to continue/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /^Sign in$/i })).toBeVisible();
  });

  test("admin can sign in and open the dashboard", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin E2E.");

    await page.goto("/login?next=/admin");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Good to see you.")).toBeVisible();
  });
});
