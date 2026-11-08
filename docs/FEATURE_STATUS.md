# Feature Status

Last updated: 2026-11-08

## Customer experience

| Feature | Status | Notes |
| --- | --- | --- |
| Home page | Complete | Hero, featured products, category entry points, plus the interactive product showcase slider. |
| Product showcase slider | Complete | Dark-themed two-column preview with category tabs (T-shirt, Mug, Bag, Phone case, Card), draggable before/after comparison (flat artwork vs. mockup), four dynamic slides, vertical slide navigation, responsive mobile layout, and CTA navigation. |
| Shop/catalog | Complete | Search, category, sort, pagination. |
| Product detail | Complete | Gallery, variants, printing methods, stage info, customize CTA. |
| Template gallery | Complete | Public templates with filters. |
| Fabric design editor | Complete | Multi-stage canvas, templates, clipart, fonts, uploads, undo/redo, guides, zoom. PNG/SVG/PDF exports at print DPI. |
| Autosave/version history | Complete | Autosave endpoint; version list/restore; duplicate. |
| Live pricing | Complete | Server-authoritative quote with breakdown. |
| Cart | Complete | Add/update/remove, quantity aggregation, totals, persisted server-side. |
| Stock validation | Complete | Add-to-cart and authoritative checkout validation, `select_for_update()` + `F()` decrements, transaction rollback, no negative stock. |
| Checkout/orders | Complete (demo + Stripe) | Demo checkout marks orders demo-paid; Stripe Checkout sessions + verified webhook mark orders paid. Orders are never marked paid on frontend redirect alone. Frontend offers Stripe card button when `stripe_configured` is true. |
| Order history/detail | Complete | Includes design previews and export links. Success message reflects actual payment status. |
| Account/profile | Complete | Profile updates, saved designs. |
| Auth | Complete | Register/login/refresh/logout. JWT access+refresh stored in HttpOnly cookies (`printora_access`, `printora_refresh`), never in localStorage. CSRF token enforcement for cookie-auth state-changing requests. |

## Admin studio

| Feature | Status | Notes |
| --- | --- | --- |
| Admin UI framework | Complete | Reusable AdminSidebar (collapsible desktop, mobile drawer, localStorage persistence) and AdminHeader (breadcrumbs, title, description, actions). Section-based navigation. Consistent visual design across all admin pages. |
| Role-gated admin UI | Complete | `admin`, `staff`, superuser. |
| Dashboard | Complete | Real-time stats (revenue, orders, customers, products), recent orders, recent activity, order status distribution. Collapsible sidebar with persisted state, mobile drawer, section-based navigation (OVERVIEW/COMMERCE/DESIGN/SYSTEM). |
| Orders | Complete | Search, status filter, pagination, order detail modal with status/payment updates and print-ready file downloads. |
| Products | Complete | CRUD, gallery, cover, variants, stages/print areas, printing methods. Product detail with tabs (Details/Gallery/Stages/Variants/Printing). |
| Categories | Complete | CRUD with images. |
| Pricing rules | Complete | Product/method scoped rule management. |
| Customers | Complete | List/search/detail, role and active updates. |
| Templates/cliparts/fonts | Complete | CRUD; template preview generation. |
| Store settings | Complete | Tax, shipping, threshold, announcement, demo mode, Shopify config. |
| Shopify status/sync | Complete | Status, manual sync, product/inventory sync, webhook log. |
| Printing methods | Complete | Duplicate creation returns HTTP 400 (not 500). |

## Backend platform

| Feature | Status | Notes |
| --- | --- | --- |
| JWT auth + roles | Complete | SimpleJWT; custom role permission; HttpOnly cookie authentication. |
| Public catalog APIs | Complete | Active-only products/categories; search/sort/filter. |
| Design validation | Complete | Object allowlist, image host rules (ALLOWED_IMAGE_HOSTS), size limits. |
| Upload pipeline | Complete | MIME/extension checks, sanitization, limits, throttling. |
| Pricing engine | Complete | Variants, methods, rules, quantity discounts. |
| Cart totals | Complete | Discount, shipping threshold, tax. |
| Order snapshots | Complete | Historical names/prices preserved. |
| PNG/PDF exports | Complete | Pillow renderer at print DPI with warnings. |
| SVG exports | Complete (structural) | Vector export incl. real `<path>` elements for Fabric paths; no server-side rasterization. |
| Celery pipeline | Complete | Inline by default; Redis worker in Compose. |
| Shopify webhooks | Complete | Independent webhook secret, HMAC verification, idempotent event records, order/inventory sync. |
| Health endpoint | Complete | App + DB check. |
| Admin APIs | Complete | All resources used by the admin UI. |
| Backend tests | Complete | 71 tests pass across auth, catalog, designer, commerce and production. |
| Frontend typecheck/build | Complete | TypeScript and production build pass (20 routes). |

## Infrastructure and docs

| Item | Status | Notes |
| --- | --- | --- |
| `requirements.txt` | Complete | Pinned direct dependencies. Stripe is optional (lazy import; install `stripe` for live payments). |
| Env templates | Complete | Root (Compose), backend and frontend examples (incl. `ALLOWED_IMAGE_HOSTS`, `STRIPE_*`). |
| `.gitignore` | Complete | Python, Node, env, media, test artifacts. |
| Dockerfiles + Compose | Complete (untested locally) | Compose could not be run because the Docker daemon is unavailable on the development machine. |
| README/docs set | Complete | Plan, architecture, API, schema, development, deployment. |
| Playwright E2E | Complete | 15 tests pass covering storefront, auth, studio, admin and the product showcase slider; 2 skipped (admin dashboard requires E2E_ADMIN_EMAIL/PASSWORD env vars). |
| CI pipeline | Not included | Suggested: backend tests, frontend typecheck/build, Playwright. |

## Known limitations / next work

1. **Stripe:** integration is implemented and tested with mocked Stripe responses; live processing is NOT verified because `stripe` is not installed and no real credentials are configured. Install `stripe` and set `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` for production.
2. **Cookie auth production:** HttpOnly cookies verified locally via Next proxy (same-origin). Cross-domain production deployment should set `AUTH_COOKIE_SECURE=true` and `CSRF_TRUSTED_ORIGINS` appropriately.
3. **Payments:** demo checkout remains available; integrate production payment webhooks beyond Stripe Checkout if needed.
4. **Media storage:** production media serving/object storage and CDN are documented but not provisioned.
5. **SVG rasterization:** SVG is exported structurally; there is no CairoSVG/headless-browser rasterizer.
6. **E2E coverage:** extend Playwright coverage to checkout, a full editor save/export flow and admin CRUD; the admin dashboard test requires `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`.
7. **Dependency audit:** `npm audit` reports 6 vulnerabilities (4 high, 2 critical): Fabric/canvas/tar XSS-and-archive advisories and Next.js 14 advisories whose fixes require major upgrades. Plan a framework-upgrade milestone before production.
8. **Docker verification:** Compose configuration is authored but not executed locally; validate in CI or on a Docker host.
