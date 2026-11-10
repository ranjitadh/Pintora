# MerchPress Fix Log

Date: 2026-11-07

## Phase 1 — Inspection
Inspected all eight issue areas: `backend/commerce/services.py`, `frontend/app/checkout/page.tsx`, `backend/production/render.py`, `backend/catalog/views.py`, `backend/commerce/views.py`, `frontend/lib/api.ts`, `backend/commerce/shopify.py`, `backend/config/settings.py`, plus supporting models, serializers, pricing, tests, migrations, and frontend pages/components.

## Phase 2 — Issue 1: Inventory validation & transaction-safe checkout
- `backend/commerce/services.py`: added `from django.db.models import F`; split `checkout_cart` into `_place_order` (stock validation with `select_for_update()`, atomic `F()` stock decrement, order + order-item creation) and `checkout_cart` (demo/paid marking). Stock is reserved atomically inside `@transaction.atomic`; failure rolls back everything.
- `backend/commerce/tests.py`: added `test_checkout_decrements_stock_multiple_quantities`, `test_checkout_rolls_back_on_failure`, `test_checkout_stock_never_goes_negative`; existing insufficient-stock and out-of-stock tests retained.

## Phase 3 — Issue 4: Cart quantity aggregation
- Already implemented: `add_cart_item` merges by product+variant+design+printing_method and returns `(item, created)`; `CartItemsView` returns 200 on merge, 201 on create.
- `backend/catalog/management/commands/seed_demo.py`: updated call site to unpack the tuple.
- `backend/commerce/tests.py`: `test_adding_same_item_twice_merges_into_single_line` retained.

## Phase 4 — Issue 5: Duplicate printing method API error
- Already implemented in `backend/catalog/views.py`: pre-check returns HTTP 400 before `ProductPrintingMethod.objects.create`.
- `backend/catalog/tests.py`: `test_duplicate_printing_method_link_returns_400` retained.

## Phase 5 — Issue 5 (renumbered 6): Revenue decimal formatting
- Already implemented: `money()` quantizes revenue to `Decimal("0.01")` in `AdminDashboardView`.
- `backend/commerce/tests.py`: added `test_dashboard_revenue_formatted_to_two_decimals` and `test_dashboard_revenue_zero_when_no_orders`.

## Phase 6 — Issue 3: SVG path export
- `backend/production/render.py`: added `_serialize_path()` to convert Fabric path command arrays to a valid SVG `d` string; `path` objects now render as `<path d="..." fill="..." .../>` with fill/stroke/opacity/transform instead of an XML comment.
- `backend/production/tests.py`: added `test_svg_export_renders_path_elements` and `test_svg_export_handles_multiple_and_stroked_paths`.

## Phase 7 — Issue 7: Stripe payment integration + demo separation
- `backend/config/settings.py`: added `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLIC_KEY`, `STRIPE_ENABLED` (Stripe optional; lazy import).
- `backend/commerce/models.py` + migration `0002_add_stripe_order_fields`: added `stripe_session_id` and `stripe_payment_intent_id` to `Order`.
- `backend/commerce/services.py`: added `create_stripe_checkout()` — creates a pending UNPAID order (stock reserved), builds Stripe line items server-side, creates the Checkout Session, stores `stripe_session_id`/`stripe_payment_intent_id`.
- `backend/commerce/serializers.py`: added `CheckoutSessionSerializer`.
- `backend/commerce/views.py`: added `StripeCheckoutSessionView` (POST `/api/checkout/session/`) and `StripeWebhookView` (POST `/api/stripe/webhooks/`, HMAC-verified, idempotent, marks orders paid on `checkout.session.completed` only — never on frontend redirect).
- `backend/commerce/urls.py`: added routes.
- Demo checkout preserved: `demo` flag still marks orders `PAID`/`DEMO` when `demo_mode` is on.
- `backend/commerce/tests.py`: mocked-Stripe tests for session creation, config-required 400, webhook marks paid, invalid signature 401, duplicate ignored.

## Phase 8 — Issue 7: Secure HttpOnly cookie authentication
- `backend/accounts/authentication.py`: new `AuthCookieAuthentication(JWTAuthentication)` reads the `printora_access` HttpOnly cookie when no bearer header is present; falls back to header flow.
- `backend/config/settings.py`: `DEFAULT_AUTHENTICATION_CLASSES` uses `AuthCookieAuthentication`; added `AUTH_ACCESS_COOKIE`, `AUTH_REFRESH_COOKIE`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `ENFORCE_CSRF_COOKIE_AUTH`; added `CookieAuthCSRFMiddleware` after `CsrfViewMiddleware`.
- `backend/accounts/middleware.py`: `CookieAuthCSRFMiddleware` enforces `X-CSRFToken` == `csrftoken` cookie on cookie-authenticated unsafe requests (exempts auth/csrf/webhook endpoints).
- `backend/accounts/views.py`: `LoginView`/`RegisterView` set HttpOnly access+refresh cookies and return user only (no tokens in body); `CookieTokenRefreshView` refreshes using the refresh cookie; `LogoutView` clears cookies; `CsrfTokenView` (GET `/api/auth/csrf/`) returns the CSRF token.
- `backend/accounts/urls.py`: replaced `TokenRefreshView` with `CookieTokenRefreshView`; added `logout/` and `csrf/`.
- `backend/accounts/tests.py`: updated register/login tests to assert cookies are set; login relies on cookie (not bearer header) for `/auth/me/`.
- `frontend/lib/api.ts`: removed all `localStorage` token functions; `credentials: "include"` on every fetch; CSRF token fetched from `/auth/csrf/` and sent as `X-CSRFToken` on unsafe methods; 401 triggers refresh via `/auth/refresh/` (cookie-driven) then `printora:logout` on failure.
- `frontend/lib/auth.tsx`: login/register/logout use cookie-backed endpoints; session confirmed via `/auth/me/`; no localStorage.
- `frontend/app/editor/[slug]/page.tsx` and `frontend/app/admin/products/[id]/page.tsx`: updated to the new `request()` signature / removed `getAccessToken()`.

## Fix: Stripe checkout frontend + store config
- `backend/commerce/serializers.py`: Added `stripe_configured` SerializerMethodField to `StoreConfigSerializer` so the frontend knows whether Stripe is enabled.
- `frontend/app/checkout/page.tsx`: Fetches `/store/config/`; shows Stripe card-payment button when `stripe_configured` is true, demo button otherwise. Stripe checkout creates a server-side session and redirects to `session.url`. Order is left UNPAID until a verified `checkout.session.completed` webhook marks it paid — a frontend redirect alone never marks an order paid.
- `frontend/lib/types.ts`: Added `stripe_configured: boolean` to `StoreConfig`.
- `frontend/app/orders/[id]/page.tsx`: Order-placed success message now reflects actual `payment_status` ("Your payment is confirmed" vs "Your demo payment is confirmed").

## Fix: SVG/PDF export in design editor
- `frontend/components/design-editor.tsx`: `handleDownload(fileType)` supports `"png" | "svg" | "pdf"`; three export buttons (PNG/SVG/PDF) replaced the single PNG button. SVG export uses real `<path>` elements (see BUG-005); PDF uses the Pillow renderer at 300 DPI.

## Verification performed
- Backend: `manage.py test` → 71 tests OK; `manage.py check` and `makemigrations --check --dry-run` clean.
- Frontend: `npm run typecheck` and `npm run build` pass (20 routes).
- E2E: `npx playwright test` → 8 passed, 1 skipped (admin dashboard requires env vars).
- `npm audit` findings remain documented as a planned framework-upgrade milestone.

## Session 2026-11-10 — Six reported issues

### Phase 9 — Homepage JSX/build failure
- `frontend/app/page.tsx`: repaired the broken JSX tree (mismatched closing tags), corrected the invalid `Button` usage to `LinkButton` with a real `href`, restored the `money` import, removed unused imports, and kept the existing hero/showcase/collection sections.
- Verification: `npm run typecheck`, `npm run build`, and the Playwright homepage CTA test.

### Phase 10 — Design-studio template crash
- `frontend/components/design-editor.tsx`: `applyTemplate` read a non-existent `templateContent?.canvas_json` after an earlier edit. It now uses the API field `template.canvas_json`, checks that the object actually contains content, and wraps `canvas.loadFromJSON` in `try/catch` with a user-facing notice and `loadingRef` reset.
- Verification: Playwright template-drag test and all ceramic-mug editor tests.

### Phase 11 — Newsletter migration
- Confirmed `backend/commerce/migrations/0003_newslettersubscriber.py` was present but unapplied. Backed up `backend/db.sqlite3`, applied the migration, and verified `[X] 0003_newslettersubscriber`.
- `backend/commerce/tests.py`: added `NewsletterApiTests` (valid 201, duplicate 200 case-insensitive, source update/reactivate, invalid 400, missing 400).
- Existing row counts preserved (users 144, orders 18, carts 158, products 61, designs 50 at migration time).

### Phase 12 — Dark mode
- `frontend/app/globals.css`: corrected `.html.dark` → `html.dark` for `.field`/`.card`; added dark surfaces for fields, cards, table headers/rows, modal panels, selects/options/inputs, and mapped fixed utilities (`bg-cream`, `bg-sand`, `bg-white`, `text-ink`, `text-muted`) to dark equivalents.
- `frontend/tailwind.config.ts`: moved `darkMode: "class"` to the top-level config.
- `frontend/app/layout.tsx`: wrapped the app in `ThemeProvider`.
- `frontend/lib/theme.tsx`: removed the mounted guard that could render children without context; `frontend/lib/theme.ts` deleted as a duplicate.
- `frontend/components/theme-toggle.tsx`: uses `toggleTheme` from context.
- `frontend/components/ui.tsx`: added `modal-panel` class to `Modal`.
- `frontend/components/site-header.tsx` and `frontend/components/admin.tsx`: dark variants for header/admin surfaces.
- Verification: new Playwright test asserts a card's computed background changes and the theme persists after reload.

### Phase 13 — Chatbot unread counter
- `frontend/components/chatbot.tsx`: added `openRef`; unread increments only for `assistant` messages while the panel is closed; the count resets on open (fixed the inverted reset in `toggleOpen`); badge uses `relative` positioning.
- Verification: new Playwright test with a delayed assistant response asserts badge `1` while closed and cleared after opening.

### Phase 14 — WhiteNoise static warning
- `backend/config/settings.py`: WhiteNoise middleware is now inserted only when `os.path.isdir(STATIC_ROOT)`; `STATIC_ROOT` remains `BASE_DIR / "staticfiles"`.
- Verification: `manage.py check` clean; `collectstatic --noinput` copied 161 files and post-processed 463; a `runserver` start with `staticfiles/` temporarily removed produced no WhiteNoise warning.

### Phase 15 — Regression harness fixes
- `frontend/playwright.config.ts`: E2E backend runs with high throttle limits (`THROTTLE_ANON=5000/min`, `THROTTLE_USER=5000/min`, `THROTTLE_AUTH=1000/min`, `THROTTLE_UPLOAD=1000/hour`) because the suite legitimately exceeds the production 120/min anonymous limit. Production throttle defaults remain unchanged.
- `frontend/e2e/storefront.spec.ts`: homepage CTA assertion updated from the stale “Start designing” label to the current “Shop design” link.
- `frontend/e2e/ceramic-mug-editor.spec.ts`: cart artwork assertion now derives the design name from the product API (`Artwork: ${product.name} design`) instead of the stale “Ceramic Wrap Mug” name.
- `frontend/e2e/ui-fixes.spec.ts`: added dark-mode and assistant unread-badge regression tests.
- Final E2E result: **22 passed, 2 skipped, 0 failed** (admin login tests need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`).

### Phase 16 — Shop-page dark-mode polish
- `frontend/app/globals.css`: added dark counterparts for the fixed utility classes used by the shop page — `text-ink` opacity variants (`/75`, `/70`, `/60`, `/40`, `/25`, `/20`, `/15`), `bg-olive-soft`, `text-olive`/`text-olive/80`, `border-ink` opacities (`/5`–`/40`), `bg-ink/5`/`bg-ink/10`, and hover variants for ink backgrounds, borders and text.
- Inactive category buttons were rendering dark ink on a dark surface because `text-ink/70` had no dark mapping; they now use translucent cream. The “Not sure where to start?” promo box (`bg-olive-soft`) now uses the dark olive surface and light olive text.
- Clay accents (`text-clay`, `text-clay-dark` and their hover variants) are lightened in dark mode to keep the shop eyebrow, footer and links above 4.5:1 contrast.
- `frontend/e2e/ui-fixes.spec.ts`: added a shop dark-mode regression test that opens `/shop`, enables dark mode, and asserts the category label is a light color and the olive promo surface is dark.
- Verification: automated contrast scan found no shop text below 4.5:1 in dark mode; desktop and mobile dark screenshots reviewed; `ui-fixes.spec.ts` 3/3 passed.

### Phase 17 — Editor readiness guard found during verification
- `frontend/components/design-editor.tsx`: “Add to canvas” is now disabled until the Fabric editor reports `ready`, and `addText` also guards on `ready`. Previously a fast click during Fabric's async initialization silently added nothing and the next save persisted an empty design.
- Verification: `ceramic-mug-editor.spec.ts` save/reload/export/cart test passes; the saved design contains the text layer and reloads with it.

### Final re-verification after shop/editor changes
- `cd frontend && npm run typecheck && npm run build`: both pass after the final edits.
- Full Playwright suite: **23 passed, 2 skipped, 0 failed** (25 total; admin sign-in/dashboard tests still need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`).
- Backend was unchanged by this phase; the previous **91 tests OK** result still applies.
- Local-environment note: multiple `next dev` processes sharing the same `.next` directory produced intermittent “missing required error components” 500s during test runs. `.next` was cleared and a single dev server on port 3000 was used; this was a harness issue, not an application defect.

### Phase 18 — Shop media hero (photo + video)
- Added a full-width editorial hero to `frontend/app/shop/page.tsx` between the collection intro and the product grid: a studio photograph backs the section, with an overlaid copy block (`Made by hand. Printed for you.`), three proof-point stats and a `Shop the collection` anchor to `#collection`.
- Added a looping studio video card inside the hero with a poster fallback, `autoPlay`, `muted`, `loop`, `playsInline`, `preload="metadata"` and an accessible label. The card is labelled `Inside the studio · 06s loop`.
- `frontend/app/globals.css`: added `.shop-hero`, `.shop-hero-photo`, `.shop-hero-scrim`, `.shop-hero-texture` (subtle SVG grain), `.shop-hero-video` and `.shop-filter-panel` styles, including responsive/mobile rules and a reduced-motion fallback for the photo transform.
- Wrapped the shop filter sidebar in the new `.shop-filter-panel` card so the sticky controls read as one polished surface in light and dark mode.
- Assets (Pexels, free license, no attribution required):
  - Photo: “A Hand Painting a White Shirt” by Tima Miroshnichenko, Pexels photo 8764563, resized/compressed locally to `frontend/public/studio/shop-studio.jpg` (1800×1199, 270 KB).
  - Video: “Professional Screen Printing in Action” by alexandre ribeyrolles, Pexels video 34888657, trimmed to a 6-second 960×540 loop at `frontend/public/studio/shop-studio.mp4` (3.5 MB) with a local poster `frontend/public/studio/shop-studio-poster.jpg`.
- `frontend/e2e/storefront.spec.ts`: added a test asserting the hero photo, video source, poster, ready state, muted and loop attributes.
- Stabilized the existing template-drag E2E test so it waits for the editor warm-up overlay and the applied-template notice before dragging; this removes a cold-compile race exposed by the larger shop page.
- Verification: shop contrast scan still reports no text below 4.5:1; light, dark and mobile screenshots reviewed; full suite **24 passed, 2 skipped, 0 failed** (26 total); typecheck and production build pass. Build route size for `/shop` increased from 5.44 kB to 11.6 kB.

### Phase 19 — Full-screen shop experience and catalog optimization
- Rebuilt the `/shop` opening as a full-bleed, first-viewport cinematic video hero: the 6-second studio loop now fills the screen edge-to-edge (height accounts for the announcement bar and sticky header), with the headline, CTA, stats and the hand-painting photo inset composed over it.
- The video remains `autoPlay muted loop playsInline` with a poster fallback; `prefers-reduced-motion` replaces the video with its poster frame instead of animating it.
- `frontend/app/globals.css`: replaced the old boxed hero styles with `.shop-hero`, `.shop-hero-bg`, `.shop-hero-inner`, `.shop-hero-card` and `.shop-hero-control`; added responsive scrims and removed the dead `.shop-hero-video`/`.shop-hero-photo` rules.
- Split `frontend/app/shop/page.tsx` into an async server component plus `frontend/app/shop/shop-content.tsx`. The server fetches the first 24 products and categories (30s revalidation) and renders them into the HTML; the client skips its initial refetch when that data is present. Backend origin comes from `BACKEND_INTERNAL_URL` or `NEXT_PUBLIC_BACKEND_ORIGIN`.
- Added shop metadata (title, description, canonical, Open Graph, Twitter) and an `ItemList` JSON-LD block. Set `NEXT_PUBLIC_SITE_URL` in production for absolute canonical/social URLs. The value falls back to the server-side `SITE_URL`, and both env examples, the frontend Dockerfile and the Compose frontend service now carry it.
- Added catalog pagination: 24 products per page with a `Show more pieces` button that appends the next page; changing search, category or sort resets to page 1.
- Search, category and sort now sync to the URL with `history.replaceState`, so filtered views are shareable and reload correctly.
- Mobile catalog: two-column product grid, compact card typography and stacked pricing, promo box hidden below desktop, and the filter panel only sticks on desktop.
- Performance/accessibility: lazy/async product images with intrinsic dimensions, a matching skeleton grid, `aria-live` result count, `aria-pressed` category chips, labelled sort control, custom search clear button, and reduced-motion/reduced-data-friendly hero fallback.
- `frontend/e2e/storefront.spec.ts`: expanded shop coverage to catalog SSR, hero media, pause/resume, load-more (24 → 48), category filtering plus URL sync, server-rendered metadata/ItemList, and a no-hydration-refetch assertion.
- Hardened `frontend/e2e/full-workflow.spec.ts` to ignore aborted Next.js RSC prefetch requests (`_rsc`), which are expected when navigating away; other failed requests and 5xx responses still fail the test.
- Verification: typecheck and production build pass; full suite against `next start` is **29 passed, 2 skipped, 0 failed** (31 total); shop contrast scan still reports no text below 4.5:1, and the reduced-motion fallback was verified (no video element, poster shown, no pause control). `/shop` is now a dynamic route (`ƒ`, 11.7 kB) because it renders filtered server data per request.

### Phase 20 — Template library optimization
- Rebuilt `frontend/app/templates/page.tsx` as an async server component plus `frontend/app/templates/templates-content.tsx`. The server fetches public templates (60s revalidation) and renders them into the HTML; the client skips its initial refetch when that data is present.
- Added page metadata (title, description, canonical, Open Graph, Twitter) and an `ItemList` JSON-LD block. Set `NEXT_PUBLIC_SITE_URL` in production for absolute canonical/social URLs.
- Editorial hero with copy, search, stats (layouts/canvases/free) and a featured-layout spotlight card linking to the studio.
- Category filter chips with counts, result-count `aria-live`, clear filters, URL-synced search/category (`history.replaceState`), and filtered views that persist after reload.
- Template cards are now full links (mobile-accessible), with `object-contain` previews so wide designs are never cropped, category badge, price, product name, description, and an always-visible "Use template" CTA. Two-column mobile grid, three-column desktop grid, lazy images with intrinsic dimensions, skeletons, and empty state.
- Added `product_name` to `TemplateSerializer` and `Template` type so cards show real product names (e.g. "Heavy Canvas Tote") instead of slugs.
- Dark-mode surfaces for hero, cards, chips and buttons verified alongside existing dark-mode coverage.
- Added 4 E2E tests: SSR metadata/ItemList/no-refetch, search URL sync, category filter count+URL+persistence, and mobile card → studio navigation.
- Verification: typecheck passes; production build passes (`/templates` 7.19 kB); backend `manage.py test` → 91 OK; full E2E suite → **33 passed, 2 skipped, 0 failed** (35 total).

### Phase 21 — Design library optimization
- Rebuilt `frontend/app/designs/page.tsx` as a server page with metadata plus `frontend/app/designs/designs-content.tsx` client component. Metadata (title, description, canonical, Open Graph, Twitter) is rendered server-side; the authenticated design list is fetched client-side since it requires session cookies.
- Backend: added `SearchFilter`/`OrderingFilter` to `DesignViewSet` with `search_fields = ["name"]` and `ordering_fields = ["name", "created_at", "updated_at"]`, default ordering `-updated_at`.
- Client catalog: search by name, sort (newest/oldest/name A–Z/Z–A), URL-synced pagination (`?search=`, `?sort=`, `?page=`) with prev/next controls and result-count `aria-live`.
- Design cards: `object-cover` previews with lazy loading, design-specific status badges (draft/saved/ordered/etc.), name, product · stage · version, updated date, and labeled action buttons — Edit (primary), Duplicate, Download, Delete. Two-column mobile grid, three-column desktop, four-column wide.
- Delete uses a confirmation Modal instead of `window.confirm`. Download creates an export and polls `/api/exports/{id}/` until completed, then opens the file in a new tab.
- Skeleton loading states, empty state with clear search / start-designing CTAs, error state with retry, dark-mode surfaces for hero, cards, chips and buttons.
- Added 7 E2E tests: SSR metadata/rendering, search filter + URL sync, no-results empty state, sort URL sync, pagination URL sync, duplicate creates a copy, delete confirmation modal removes the design.
- Verification: typecheck passes; production build passes (`/designs` 7.73 kB); backend `manage.py test` → 91 OK; full E2E suite → **39 passed, 2 skipped, 0 failed** (41 total).
