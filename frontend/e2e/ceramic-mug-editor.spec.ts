import { expect, test, type Page } from "@playwright/test";

const VARIANT_11_OZ = "b6fb1bcd-cb22-4279-bdf1-d92484e80177";
const VARIANT_15_OZ = "5144c383-ad02-4230-a303-567e640ab848";
const SUBLIMATION = "b203b7da-3c89-4cb3-8bac-355a82d96a9f";
const REQUESTED_METHOD_FROM_REPORT = "b203b7da-3c89-4cb8-8bac-355a82d96a9f";

const exactReportedUrl = `/editor/ceramic-mug?variant=${VARIANT_11_OZ}&method=${REQUESTED_METHOD_FROM_REPORT}`;
const validUrl = `/editor/ceramic-mug?variant=${VARIANT_11_OZ}&method=${SUBLIMATION}`;

async function openEditor(page: Page, url = validUrl) {
  await page.goto(url);
  await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("stage-mockup")).toBeVisible();
}

async function register(page: Page, prefix: string) {
  await page.goto("/register");
  await page.getByLabel("First name").fill("Ceramic");
  await page.getByLabel("Last name").fill("E2E");
  await page.getByLabel("Email").fill(`${prefix}-${Date.now()}@printora.test`);
  await page.getByLabel("Password", { exact: true }).fill("Playwright12345");
  await page.getByLabel("Confirm password").fill("Playwright12345");
  await page.getByRole("button", { name: /Create account/i }).click();
  await expect(page).toHaveURL(/\/account/);
}

test.describe("ceramic mug editor regression", () => {
  test("the reported URL renders the mug mockup and reports the unavailable method", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openEditor(page, exactReportedUrl);

    const mockup = await page.getByTestId("stage-mockup").boundingBox();
    const canvas = await page.locator(".editor-canvas canvas.upper-canvas").boundingBox();
    expect(mockup).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(canvas!.x).toBeGreaterThan(mockup!.x);
    expect(canvas!.y).toBeGreaterThan(mockup!.y);
    expect(canvas!.x + canvas!.width).toBeLessThan(mockup!.x + mockup!.width);
    expect(canvas!.y + canvas!.height).toBeLessThan(mockup!.y + mockup!.height);

    await expect(
      page.getByText(/requested printing method is not available/i)
    ).toBeVisible();
    await expect(page.getByLabel("Colour and size").first()).toHaveValue(VARIANT_11_OZ);
    await expect(page.getByLabel("Print method").first()).toHaveValue(SUBLIMATION);
    await expect(page.locator("header").getByText("$16.90", { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("an invalid variant is reported instead of silently accepted", async ({ page }) => {
    await openEditor(
      page,
      `/editor/ceramic-mug?variant=00000000-0000-0000-0000-000000000000&method=${SUBLIMATION}`
    );

    await expect(page.getByText(/requested colour\/size is not available/i)).toBeVisible();
    await expect(page.getByLabel("Colour and size").first()).toHaveValue(VARIANT_11_OZ);
  });

  test("all editor tools work and pricing follows the selected variant", async ({ page, request }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const templatesResponse = await request.get("/api/templates/");
    expect(templatesResponse.ok()).toBeTruthy();
    const templates = await templatesResponse.json();
    const template = templates.find((item: any) => item.product_slug === "ceramic-mug");
    expect(template).toBeTruthy();

    await register(page, "ceramic-tools");
    await openEditor(page);

    await expect(page.getByText(/requested printing method is not available/i)).toHaveCount(0);
    await expect(page.getByLabel("Colour and size").first()).toHaveValue(VARIANT_11_OZ);
    await expect(page.getByLabel("Print method").first()).toHaveValue(SUBLIMATION);

    const toolChecks: [string, string][] = [
      ["Product", "Colour / Size"],
      ["Templates", "Applying a template replaces the current stage canvas."],
      ["Text", "Add text"],
      ["Images", "Clipart library"],
      ["Uploads", "Drop art or browse"],
      ["Layers", "Canvas layers"],
    ];

    for (const [tool, marker] of toolChecks) {
      await page.getByRole("button", { name: tool, exact: true }).first().click();
      await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Elements", exact: true }).first().click();
    await expect(page.getByTitle("Rectangle").first()).toBeVisible();

    await page.getByRole("button", { name: "Templates", exact: true }).first().click();
    await page.getByText(template.name, { exact: true }).click();
    await expect(page.getByText(/Applied .* make it yours/i)).toBeVisible();

    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    await page.getByPlaceholder("Your words here").fill("Hello Ceramic");
    await page.getByRole("button", { name: "Add to canvas" }).click();
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Undo" }).first().click();
    await expect(page.getByRole("button", { name: "Redo" }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Redo" }).first().click();

    await page.getByRole("button", { name: "Images", exact: true }).first().click();
    await page.getByTitle("Happy Face").click();
    await page.getByRole("button", { name: "Layers", exact: true }).first().click();
    await expect(page.getByText(/[1-9]\d* objects/)).toBeVisible();

    await page.getByRole("button", { name: "Elements", exact: true }).first().click();
    await page.getByTitle("Rectangle").first().click();

    await page.getByRole("button", { name: "Uploads", exact: true }).first().click();
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "swatch.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });
    await expect(page.getByText(/swatch\.png added to your canvas/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Layers", exact: true }).first().click();
    await expect(page.getByText("Canvas layers")).toBeVisible();
    await page.getByRole("button", { name: "Forward" }).click();

    await page.getByRole("button", { name: "Mockup preview" }).click();
    await expect(page.getByText("Mockup preview", { exact: true })).toBeVisible();
    await expect(page.getByTestId("print-boundary")).toHaveCount(0);
    await page.getByRole("button", { name: "Exit mockup preview" }).click();
    await expect(page.getByTestId("print-boundary")).toHaveCount(1);

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByRole("button", { name: "Reset zoom and pan" })).toHaveText("115%");
    await page.getByRole("button", { name: "Pan mode" }).click();
    await expect(page.getByRole("button", { name: "Pan mode" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reset zoom and pan" }).click();
    await expect(page.getByRole("button", { name: "Reset zoom and pan" })).toHaveText("100%");

    await page.getByLabel("Colour and size").first().selectOption(VARIANT_15_OZ);
    await expect(page.locator("header").getByText("$19.90", { exact: true })).toBeVisible();
    await expect(page.getByText("$19.90", { exact: true }).last()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("save, reload, export and cart keep the design and configuration", async ({ page, request }) => {
    const productResponse = await request.get("/api/products/ceramic-mug/");
    expect(productResponse.ok()).toBeTruthy();
    const product = await productResponse.json();
    await register(page, "ceramic-save");
    await openEditor(page);

    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    await page.getByPlaceholder("Your words here").fill("Reload Me");
    await page.getByRole("button", { name: "Add to canvas" }).click();
    await page.getByRole("button", { name: /Save design/i }).first().click();
    await expect(page.getByText(/Design saved to your studio/i)).toBeVisible({ timeout: 15_000 });

    const savedUrl = new URL(page.url());
    const designId = savedUrl.searchParams.get("design");
    expect(designId).toBeTruthy();

    await page.reload();
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("stage-mockup")).toBeVisible();
    await page.getByRole("button", { name: "Layers", exact: true }).first().click();
    await expect(page.getByText(/text · Reload Me/i)).toBeVisible();

    page.on("popup", (popup) => popup.close());
    await page.getByRole("button", { name: "Export PNG" }).click();
    await expect(page.getByText(/Print-ready PNG generated|PNG export queued/i)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(
        async () => {
          const response = await page.request.get("/api/exports/");
          const payload = await response.json();
          return payload.results.some(
            (file: any) => file.design === designId && file.file_type === "png" && file.status === "completed"
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await page.getByRole("button", { name: /Add to cart/i }).first().click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByText("White / 11 oz · Sublimation")).toBeVisible();
    await expect(page.getByText(`Artwork: ${product.name} design`)).toBeVisible();

    const cartResponse = await page.request.get("/api/cart/");
    const cart = await cartResponse.json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].variant).toBe(VARIANT_11_OZ);
    expect(cart.items[0].printing_method).toBe(SUBLIMATION);
    expect(cart.items[0].design).toBe(designId);
    expect(cart.items[0].quantity).toBe(1);

    const duplicate = await page.request.post("/api/cart/items/", {
      data: {
        product: cart.items[0].product,
        variant: cart.items[0].variant,
        design: cart.items[0].design,
        printing_method: cart.items[0].printing_method,
        quantity: 1,
      },
    });
    expect(duplicate.ok()).toBeTruthy();
    const merged = await (await page.request.get("/api/cart/")).json();
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].quantity).toBe(2);
  });

  test("mobile and tablet layouts expose tools without breaking the mockup", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await openEditor(page);

      const mockup = await page.getByTestId("stage-mockup").boundingBox();
      const canvas = await page.locator(".editor-canvas canvas.upper-canvas").boundingBox();
      expect(mockup).not.toBeNull();
      expect(canvas).not.toBeNull();
      expect(canvas!.x).toBeGreaterThan(mockup!.x);
      expect(canvas!.y).toBeGreaterThan(mockup!.y);
      expect(canvas!.x + canvas!.width).toBeLessThan(mockup!.x + mockup!.width);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

      await page.getByRole("button", { name: "Text", exact: true }).click();
      await expect(page.getByRole("button", { name: "Close tools" })).toBeVisible();
      await expect(page.getByPlaceholder("Your words here")).toBeVisible();
      await page.getByRole("button", { name: "Close tools" }).click();
      await expect(page.getByPlaceholder("Your words here")).toBeHidden();
      await expect(page.getByTestId("stage-mockup")).toBeVisible();
    }
  });
});
