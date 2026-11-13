import { expect, test } from "@playwright/test";

test.describe("designs library", () => {
  const password = "Playwright12345";

  test.beforeEach(async ({ page, request }) => {
    const email = `e2e-designs-${Date.now()}@printora.test`;

    // Register and sign in a new customer via the UI so the session cookie is set.
    await page.goto("/register");
    await page.getByLabel("First name").fill("Designs");
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // Authenticate the API request context so we can seed a design.
    await request.post("/api/auth/login/", {
      data: { email, password },
    });

    // Seed one design via the API so the library is not empty.
    const productsResponse = await request.get("/api/products/?sort=newest");
    const products = await productsResponse.json();
    const product = products.results[0];

    const productDetailResponse = await request.get(
      `/api/products/${product.slug}/`
    );
    const productDetail = await productDetailResponse.json();
    const stage = productDetail.stages[0];

    const canvasJson = {
      stages: {
        [stage.id]: {
          version: "5.3.0",
          width: stage.print_area.width_px,
          height: stage.print_area.height_px,
          activeStage: stage.id,
          objects: [
            {
              type: "textbox",
              version: "5.3.0",
              originX: "center",
              originY: "center",
              left: stage.print_area.width_px / 2,
              top: stage.print_area.height_px / 2,
              width: 800,
              text: "E2E design",
              fontSize: 80,
              fontFamily: "Inter",
              fontWeight: "bold",
              textAlign: "center",
              fill: "#111111",
              lineHeight: 1.16,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              opacity: 1,
            },
          ],
        },
      },
      activeStage: stage.id,
    };

    const designResponse = await request.post("/api/designs/", {
      data: {
        product: product.id,
        stage: stage.id,
        name: "E2E Test Design",
        canvas_json: canvasJson,
      },
    });
    if (!designResponse.ok()) {
      const body = await designResponse.text();
      console.log("DESIGN CREATION ERROR:", body);
    }
    expect(designResponse.ok()).toBeTruthy();
  });

  test("renders the designs page with metadata and the seeded design", async ({
    page,
  }) => {
    await page.goto("/designs");
    await expect(page.getByRole("heading", { name: /Your ideas, on file/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "E2E Test Design" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit/i })).toBeVisible();
  });

  test("search filters designs and syncs to URL", async ({ page }) => {
    await page.goto("/designs");
    await page.getByLabel("Search designs").fill("E2E");
    await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent("E2E")}`));
    await expect(page.getByText("E2E Test Design")).toBeVisible();

    // Navigating directly to the filtered URL keeps the search state.
    await page.goto("/designs?search=E2E");
    await expect(page.getByLabel("Search designs")).toHaveValue("E2E");
    await expect(
      page.getByRole("heading", { name: "E2E Test Design" })
    ).toBeVisible();
  });

  test("search with no results shows empty state", async ({ page }) => {
    await page.goto("/designs");
    await page.getByLabel("Search designs").fill("zzzznomatch");
    await expect(page.getByText("No designs match")).toBeVisible();
    await expect(page.getByText("Clear search").last()).toBeVisible();
  });

  test("sort dropdown syncs to URL", async ({ page }) => {
    await page.goto("/designs");
    await page.getByLabel("Sort designs").selectOption("name_asc");
    await expect(page).toHaveURL(new RegExp(`sort=${encodeURIComponent("name_asc")}`));

    // Navigating directly to the sorted URL keeps the sort state.
    await page.goto("/designs?sort=name_asc");
    await expect(page.getByLabel("Sort designs")).toHaveValue("name_asc");
  });

  test("pagination links sync to URL", async ({ page }) => {
    await page.goto("/designs");
    // Only one design is seeded, so there is a single page and no query string.
    await expect(page).toHaveURL(/\/designs$/);
    await expect(page.getByText("1 design")).toBeVisible();
  });

  test("duplicate creates a copy of the design", async ({ page, request }) => {
    await page.goto("/designs");
    await expect(page.getByText("E2E Test Design")).toBeVisible();

    const duplicateButton = page
      .getByRole("button", { name: /Duplicate/i })
      .first();
    await expect(duplicateButton).toBeVisible();
    await duplicateButton.click();

    await expect(page.getByText(/Copy of E2E Test Design/)).toBeVisible();
    await expect(page.getByText("2 designs")).toBeVisible();
  });

  test("delete confirmation modal removes the design", async ({ page }) => {
    await page.goto("/designs");
    await expect(
      page.getByRole("heading", { name: "E2E Test Design" })
    ).toBeVisible();

    const deleteButton = page.getByRole("button", { name: /Delete/i }).first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(page.getByText("Delete design")).toBeVisible();
    await page.locator(".modal-panel").getByRole("button", { name: /Delete/i }).click();

    await expect(
      page.getByRole("heading", { name: "E2E Test Design" })
    ).not.toBeVisible();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });
});
