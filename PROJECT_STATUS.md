# Printora Project Status

Date: 2026-11-10
Repository: `plugins-web`
Stack: Django 4.2 + DRF backend (`backend/`), Next.js 14 frontend (`frontend/`), SQLite development database.

## Overall status

The six reported issues from this session are fixed and verified. A shop-page dark-mode polish pass and one additional editor readiness bug found during verification are also fixed. The backend, frontend build, and full Playwright regression suite are green.

| ID | Issue | Status |
|----|-------|--------|
| BUG-011 | Homepage JSX/build failure | FIXED AND VERIFIED |
| BUG-012 | Design-studio template application crash | FIXED AND VERIFIED |
| BUG-013 | Missing newsletter migration | FIXED AND VERIFIED |
| BUG-014 | Dark-mode styles not applied | FIXED AND VERIFIED |
| BUG-015 | Chatbot unread badge incorrect | FIXED AND VERIFIED |
| BUG-016 | WhiteNoise static-files startup warning | FIXED AND VERIFIED |
| BUG-017 | “Add to canvas” could silently drop a layer before the editor was ready | FIXED AND VERIFIED |

Detailed root causes and per-file changes are in `BUG_AUDIT.md` and `FIX_LOG.md`.

## Verification evidence

- Backend: `manage.py test` → **91 tests OK** (includes 5 new newsletter API tests).
- Backend checks: `manage.py check` → no issues; `makemigrations --check --dry-run` → no changes.
- Migration: `commerce.0003_newslettersubscriber` applied (`[X]`); existing data preserved.
- Frontend: `npm run typecheck` passes; `npm run build` succeeds.
- E2E: `npx playwright test` → **39 passed, 2 skipped, 0 failed** (41 total).
- Static files: `collectstatic --noinput` → 161 copied, 463 post-processed; no WhiteNoise warning when `staticfiles/` is absent.
- E2E-only throttle overrides live in `frontend/playwright.config.ts`; production limits are unchanged.

The two skipped E2E tests are the admin sign-in/dashboard tests, which need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`.

## Delivered changes this session

- Homepage: repaired JSX, corrected link/button usage, restored imports, and kept the existing content.
- Design editor: template application now uses `template.canvas_json`, validates content, and fails gracefully.
- Newsletter: applied migration and added API coverage for create/duplicate/reactivate/validation paths.
- Dark mode: fixed `html.dark` selectors, moved Tailwind dark mode to the top level, wired `ThemeProvider`, and added dark surfaces for shared components.
- Chatbot: unread count now tracks assistant replies while closed, clears on open, and uses correct badge positioning.
- Static assets: WhiteNoise is enabled only after `staticfiles/` exists; collection succeeds.
- Shop dark mode: mapped inactive category labels, the olive promo surface, ink borders/fills and clay accents to readable dark-mode colors; added a shop-specific Playwright regression test.
- Shop hero: rebuilt as a full-bleed, first-viewport cinematic video with a studio photo inset, pause/resume control, reduced-motion poster fallback and responsive scrims.
- Shop performance: split the page into a server-rendered shell plus client catalog, so the first 24 products and categories arrive in the HTML; added 30s-cached server fetches and avoided the hydration refetch.
- Shop catalog: added 24-item pagination (`Show more pieces`), URL-synced search/category/sort, result-count announcements and loading skeletons.
- Shop mobile/SEO: two-column mobile grid, compact cards, desktop-only sticky filters, shop metadata plus `ItemList` JSON-LD, and lazy-loaded product images.
- Shop tests: added hero pause/resume, load-more, category URL filtering, SSR metadata and no-refetch assertions.
- Templates library: rebuilt as SSR shell + client filter experience; editorial hero with spotlight, category chips with counts, URL-synced search/category, mobile-accessible full-link cards, lazy images, metadata and `ItemList` JSON-LD; added `product_name` to the template API; added 4 template E2E tests.
- Design library: rebuilt as server page with metadata plus client filter experience; search, sort, URL-synced pagination, result-count `aria-live`, labeled action cards (Edit/Duplicate/Download/Delete), delete confirmation modal, export download polling, lazy images, skeletons, empty state, dark-mode surfaces; added `SearchFilter`/`OrderingFilter` to the Design API; added 7 design E2E tests.
- Design editor: disabled “Add to canvas” until Fabric reports ready, preventing a fast click from saving an empty design.
- Tests: added dark-mode, shop dark-mode and chatbot regression tests; updated stale CTA and product-name assertions.

## Known limitations

- Stripe integration is verified with mocks only; no live credentials or live webhook verification.
- Shopify sync is verified with local fixtures only.
- Docker Compose is authored but has not been executed on this machine.
- Production media/object storage and CDN are not provisioned.
- `/shop`, `/templates` and `/designs` server rendering require `BACKEND_INTERNAL_URL` (or `NEXT_PUBLIC_BACKEND_ORIGIN`) and `NEXT_PUBLIC_SITE_URL` to be configured in the deployment environment.
- No ESLint configuration or `lint` script exists in `frontend/package.json`; typecheck and build are the frontend gates.
- Playwright does not cover admin CRUD; the admin sign-in/dashboard test is skipped without `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`.
- E2E tests create data in the development database (users, carts, designs, orders).

## Recommended next steps

1. Configure real Stripe keys and validate the checkout/webhook flow in a staging environment.
2. Add ESLint (e.g. `eslint-config-next`) and a `lint` script, then add it to CI gates.
3. Add Playwright coverage for checkout and admin CRUD.
4. Validate Docker Compose and production static/media configuration on a deployment host.
5. Plan the framework-upgrade milestone for the `npm audit` findings documented in `BUG_AUDIT.md`.
