# Printora Test Report

Date: 2026-11-08

## Backend tests

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
- CTA buttons navigate to valid Printora pages
- Mobile layout stacks content and keeps the slider usable

## Dependency audit

`npm audit --omit=dev` reports 6 vulnerabilities (4 high, 2 critical): Fabric/canvas/tar XSS-and-archive advisories and Next.js 14 advisories. Fixes require major upgrades and are tracked as a planned milestone, not a blocking defect.

## Docker

Compose configuration authored; could not be executed locally because the Docker daemon is unavailable on the development machine. Validate in CI or on a Docker host.