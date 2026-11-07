# Printora Fix Log

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
