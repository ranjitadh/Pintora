import { expect, test } from "@playwright/test";

test.describe("public storefront", () => {
  test("home page renders the primary call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Wear your/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shop design/i }).first()).toBeVisible();
  });

  test("footer newsletter accepts a subscription", async ({ page }) => {
    await page.goto("/");
    const newsletter = page.getByTestId("newsletter-form");
    await newsletter.scrollIntoViewIfNeeded();
    await expect(newsletter).toBeVisible();
    await newsletter.locator("#footer-newsletter-email").fill(`newsletter-${Date.now()}@printora.test`);
    await newsletter.getByRole("button", { name: /Join the list/i }).click();
    await expect(page.getByRole("status")).toContainText(/on the list|already subscribed/i);
  });

  test("home hero pairs a studio photo with a looping video", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("section.home-hero");
    await expect(hero).toBeVisible();

    const video = hero.locator("video");
    await expect(video).toHaveAttribute("src", "/studio/home-studio.mp4");
    await expect(video).toHaveAttribute("poster", "/studio/shop-studio-poster.jpg");
    await expect.poll(async () => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 15000 }).toBeGreaterThan(0);
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
    expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true);
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

  test("shop hero pairs a studio photo with a looping video", async ({ page }) => {
    await page.goto("/shop");
    const hero = page.locator("section.shop-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByAltText(/hand-painting lettering/i)).toBeVisible();

    const video = hero.locator("video");
    await expect(video).toHaveAttribute("src", "/studio/shop-studio.mp4");
    await expect(video).toHaveAttribute("poster", "/studio/shop-studio-poster.jpg");
    await expect.poll(async () => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
    expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true);
  });

  test("shop loads the next page of products", async ({ page }) => {
    await page.goto("/shop");
    const cards = page.locator('#collection a[href^="/products/"]');
    await expect(cards).toHaveCount(24);
    await page.getByRole("button", { name: "Show more pieces" }).click();
    await expect(cards).toHaveCount(48);
  });

  test("shop filters by category", async ({ page, request }) => {
    const response = await request.get("/api/categories/");
    const categories = await response.json();
    const category = categories.find((item: any) => item.product_count > 0 && item.product_count <= 24);
    if (!category) throw new Error("No paginated category available for the filter test.");
    const escapedName = category.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const chip = page.getByRole("button", { name: new RegExp(`^${escapedName}\\b`) });

    await page.goto("/shop");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(new RegExp(`category=${category.slug}`));
    await expect(page.locator('#collection a[href^="/products/"]')).toHaveCount(category.product_count);
    await expect(page.getByText(`${category.product_count} product${category.product_count === 1 ? "" : "s"}`)).toBeVisible();
  });

  test("shop is server rendered with metadata and an item list", async ({ request }) => {
    const response = await request.get("/shop");
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain("Shop custom-printed apparel");
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain("Find your canvas.");
  });

  test("shop hydrates the server catalog without refetching it", async ({ page }) => {
    const catalogRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/products") || url.includes("/api/categories")) catalogRequests.push(url);
    });
    await page.goto("/shop");
    await expect(page.locator('#collection a[href^="/products/"]').first()).toBeVisible();
    expect(catalogRequests).toEqual([]);
  });

  test("product detail exposes the studio entry point", async ({ page, request }) => {
    const response = await request.get("/api/products/?sort=newest");
    const payload = await response.json();
    const slug = payload.results[0].slug;

    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("link", { name: /Customize this product/i })).toBeVisible();
  });

  test("unknown product slugs return a real 404", async ({ request }) => {
    const response = await request.get("/products/does-not-exist");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain("This piece isn");
  });

  test("free-shipping copy matches the configured threshold", async ({ page, request }) => {
    const configResponse = await request.get("/api/store/config/");
    const config = await configResponse.json();
    const threshold = Number(config.free_shipping_threshold);

    await page.goto("/products/classic-tee");
    await expect(page.getByText(`Free shipping over $${threshold}`).first()).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(`Free shipping over $${threshold}`).first()).toBeVisible();
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
    expect(templatesResponse.ok()).toBeTruthy();
    const templates = await templatesResponse.json();
    const template = templates.find((item: any) => item.slug === "mono-grid");
    expect(template).toBeTruthy();

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/editor/art-poster");
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Warming up the studio…")).toBeHidden({ timeout: 30_000 });
    await page.getByRole("button", { name: "Templates" }).first().click();
    await page.getByText(template.name, { exact: true }).click();
    await expect(page.getByText(/Applied/)).toBeVisible();

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

  test.describe("templates page", () => {
    test("server renders metadata, item list, and initial templates without client refetch", async ({ page, request }) => {
      const templatesResponse = await request.get("/api/templates/");
      expect(templatesResponse.ok()).toBeTruthy();
      const templates = await templatesResponse.json();
      expect(templates.length).toBeGreaterThan(0);

      const pageRequests: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("/api/templates")) pageRequests.push(req.url());
      });

      await page.goto("/templates");
      await expect(page.getByRole("heading", { name: /Start with a spark/i })).toBeVisible();
      await expect(page.getByText(templates[0].name)).toBeVisible();
      await expect(page.getByText("All").first()).toHaveAttribute("aria-pressed", "true");
      expect(pageRequests).toEqual([]);
    });

    test("search filters templates and syncs to URL", async ({ page, request }) => {
      const templatesResponse = await request.get("/api/templates/");
      const templates = await templatesResponse.json();
      const name = templates[0].name;
      const firstWord = name.split(" ")[0];

      await page.goto("/templates");
      await page.getByLabel("Search templates").fill(firstWord);
      await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(firstWord)}`));
      await expect(page.locator("#template-grid a[data-template-card]")).toHaveCount(1);
      await expect(page.getByText(name)).toBeVisible();

      // Reload keeps the filtered search state.
      await page.reload();
      await expect(page.getByLabel("Search templates")).toHaveValue(firstWord);
      await expect(page.locator("#template-grid a[data-template-card]")).toHaveCount(1);
    });

    test("category filter updates count, cards, and URL", async ({ page, request }) => {
      const categoriesResponse = await request.get("/api/templates/");
      const templates = await categoriesResponse.json();
      const category = String(([...new Set(templates.map((item: any) => item.category))][0]) as string) || "";
      const count = templates.filter((item: any) => String(item.category) === category).length;

      await page.goto("/templates");
      const chip = page.getByRole("button", { name: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) });
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(new RegExp(`category=${encodeURIComponent(category)}`));
      await expect(page.locator("#template-grid a[data-template-card]")).toHaveCount(count);
      await expect(page.getByText(`${count} template${count === 1 ? "" : "s"}`)).toBeVisible();

      const allChip = page.getByRole("button", { name: new RegExp(`^All\\b`) });
      await allChip.click();
      await expect(allChip).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#template-grid a[data-template-card]")).toHaveCount(templates.length);
    });

    test("mobile cards are links that open the studio with the template id", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/templates");
      await expect(page.getByRole("heading", { name: /Start with a spark/i })).toBeVisible();

      const firstCard = page.locator("#template-grid a[data-template-card]").first();
      await expect(firstCard).toBeVisible();
      const href = await firstCard.getAttribute("href");
      expect(href).toMatch(/\/editor\/[^/]+\?template=/);

      await firstCard.click();
      await expect(page).toHaveURL(/.*\/editor\/.*\?template=/);
    });
  });
});

test.describe("customer auth", () => {
  test("a new customer can register and reach the account page", async ({ page }) => {
    const email = `e2e-${Date.now()}@printora.test`;
    const firstName = "E2E";

    await page.goto("/register");
    await page.getByLabel("First name").fill(firstName);
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Email", { exact: true }).fill(email);
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
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Good to see you.")).toBeVisible();
  });
});
