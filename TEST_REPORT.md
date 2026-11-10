# MerchPress Test Report

## Session 2026-11-10 — Current verification

### Backend

Command: `cd backend && .venv/bin/python manage.py test --verbosity=1`

Result: **91 tests OK**.

- Includes the 5 new `NewsletterApiTests`.
- `manage.py check`: no issues.
- `makemigrations --check --dry-run`: no changes detected.
- `showmigrations commerce`: `[X] 0003_newslettersubscriber`.
- Existing database row counts preserved when the migration was applied (users 144, orders 18, carts 158, products 61, designs 50 at migration time).

### Frontend

Commands: `cd frontend && npm run typecheck && npm run build`

Result: TypeScript passes; production build succeeds.

### E2E (Playwright)

Command: `cd frontend && npx playwright test`

Result: **39 passed, 2 skipped, 0 failed** (41 total).

- The 2 skipped tests are the admin sign-in/dashboard tests, which require `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`.
- E2E backend throttle limits are raised in `frontend/playwright.config.ts` only; production defaults are unchanged.
- New coverage this session:
  - Dark-mode card surface change and persistence after reload.
  - Shop-page dark mode: inactive category labels remain light and the olive promo surface turns dark.
  - Shop hero: the full-bleed studio video fills the first viewport, the hand-painting photo renders, and the video is present, muted and looping.
  - Shop catalog pagination loads the next page (24 → 48 products).
  - Category filtering updates the product count, visible cards and the shareable URL.
  - `/shop` is server-rendered with catalog metadata and an `ItemList` JSON-LD block.
  - The hydrated shop does not refetch the server-rendered first page.
  - `/templates` is server-rendered with metadata and an `ItemList` JSON-LD block; the hydrated page does not refetch the server-rendered template list.
  - Templates page search filters and syncs to the URL; category filtering updates the count, visible cards and shareable URL, and persists after reload.
  - Template cards on mobile are links that open the studio with `?template=<id>`.
  - `/designs` library: server page with metadata, SSR shell plus client filter experience; search, sort (newest/oldest/name), URL-synced pagination, result-count `aria-live`, labeled action cards (Edit/Duplicate/Download/Delete), delete confirmation modal, export download polling, lazy images, skeletons, empty state, dark-mode surfaces; added `SearchFilter`/`OrderingFilter` to the Design API; 7 new design E2E tests.
  - Assistant unread badge increments while closed and clears when opened.
  - Existing template-drag, editor save/reload/export/cart, storefront, auth and checkout workflow tests remain green.
- The editor save/reload/export/cart test also guards the Fabric readiness race fixed in `design-editor.tsx` (“Add to canvas” now waits for `ready`).

### Static files

- `collectstatic --noinput`: 161 files copied, 463 post-processed.
- Startup with `backend/staticfiles/` temporarily removed: no WhiteNoise warning.
- `backend/staticfiles/` is generated and gitignored.

### Notes

- No ESLint configuration or `lint` script exists in `frontend/package.json`; `tsc --noEmit` and `next build` are the frontend gates.
- During verification, multiple `next dev` processes sharing the same `.next` directory caused intermittent “missing required error components” 500s. `.next` was cleared and a single dev server on port 3000 was used; this was a local harness issue, not an application defect.
- Dark-mode shop verification used an automated contrast scan (no text below 4.5:1) plus desktop and mobile screenshots.
- Shop hero media is stored locally in `frontend/public/studio/` (Pexels free-license photo + trimmed 960×540 video with poster).
- `/shop` is now a server-rendered dynamic route (`ƒ`, 11.7 kB). `/templates` is also server-rendered (`ƒ`, 7.19 kB). `/designs` is server-rendered (`ƒ`, 7.73 kB). Production must expose the backend to the Next server via `BACKEND_INTERNAL_URL` (or `NEXT_PUBLIC_BACKEND_ORIGIN`) and set `NEXT_PUBLIC_SITE_URL` for correct canonical/Open Graph/JSON-LD URLs.
- The customer full-workflow test ignores aborted Next.js RSC prefetches (`_rsc`), which are expected cancellations during navigation; all other failed requests and 5xx responses still fail the test.
- Final E2E run: **39 passed, 2 skipped, 0 failed** (41 total). TypeScript and production build pass.

## Previous baseline — 2026-11-08

### Backend tests

Command: `cd backend && .venv/bin/python manage.py test --verbosity=1`

Result: **86 tests OK** across auth, catalog, designer, commerce, and production.

- Django system checks: no issues.
- `makemigrations --check --dry-run`: no changes detected (migrations consistent).

## Backend test breakdown

- `accounts.tests.AuthApiTests`: 8 OK (cookie-based login/register/me/profile; tokens asserted via HttpOnly cookies).
- `catalog.tests.CatalogApiTests`: public/admin product, category, stage, variant, printing-method (incl. duplicate 400) tests OK.
- `commerce.tests.CommerceApiTests`: 28 OK (pricing authority, cart add/update/remove/dedup, stock validation at add and checkout, transaction rollback, stock never negative, revenue formatting, Stripe mocked session + webhook, Shopify webhook/inventory sync/secret separation).
- `designer.tests.DesignerApiTests`: design create/update/autosave/duplicate, image validation (incl. `ALLOWED_IMAGE_HOSTS`/custom domain), SVG upload sanitization OK.
- `production.tests.ProductionApiTests`: PNG/SVG/PDF export, customer SVG restriction, admin SVG, export scoping, SVG path elements OK.

## Frontend checks

Command: `cd frontend && npm run typecheck && npm run build`

Result: TypeScript passes; production build succeeds (20 routes).

## E2E tests

Command: `cd frontend && npx playwright test`

Result: **15 passed, 2 skipped** (admin dashboard test skipped because `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` not set).

### E2E test coverage

**Public storefront:**
- Home page renders primary CTA
- Health endpoint reports healthy API
- Shop lists seeded catalog
- Product detail exposes studio entry point
- Studio loads for a product with stages
- Template text can be dragged on canvas

**Customer auth:**
- New customer can register and reach account page

**Admin access:**
- Admin area is protected when signed out
- Admin dashboard requires env vars (skipped)

**Full workflow (customer):**
- Register, login, browse shop, view product, add to cart, checkout, order history

**Full workflow (design editor):**
- Text, shapes, layers, undo/redo, save/reload, exports (PNG/SVG/PDF)

**Product showcase slider:**
- Initial showcase renders slider, category tabs and vertical navigation
- Switching product categories updates the preview, mockup and right-side content
- Vertical slide navigation updates the right-side content
- CTA buttons navigate to valid MerchPress pages
- Mobile layout stacks content and keeps the slider usable

## Dependency audit

`npm audit --omit=dev` reports 6 vulnerabilities (4 high, 2 critical): Fabric/canvas/tar XSS-and-archive advisories and Next.js 14 advisories. Fixes require major upgrades and are tracked as a planned milestone, not a blocking defect.

## Docker

Compose configuration authored; could not be executed locally because the Docker daemon is unavailable on the development machine. Validate in CI or on a Docker host.