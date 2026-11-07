# Feature Status

Last updated: 2026-11-07

## Customer experience

| Feature | Status | Notes |
| --- | --- | --- |
| Home page | Complete | Hero, featured products, category entry points. |
| Shop/catalog | Complete | Search, category, sort, pagination. |
| Product detail | Complete | Gallery, variants, printing methods, stage info, customize CTA. |
| Template gallery | Complete | Public templates with filters. |
| Fabric design editor | Complete | Multi-stage canvas, templates, clipart, fonts, uploads, undo/redo, guides, zoom. |
| Autosave/version history | Complete | Autosave endpoint; version list/restore; duplicate. |
| Live pricing | Complete | Server-authoritative quote with breakdown. |
| Cart | Complete | Add/update/remove, totals, persisted server-side. |
| Checkout/orders | Complete (demo) | Order creation without payment capture. |
| Order history/detail | Complete | Includes design previews and export links. |
| Account/profile | Complete | Profile updates, saved designs. |
| Auth | Complete | Register/login/refresh, JWT session in `localStorage`. |

## Admin studio

| Feature | Status | Notes |
| --- | --- | --- |
| Role-gated admin UI | Complete | `admin`, `staff`, superuser. |
| Dashboard | Complete | Counts, revenue, recent orders/designs, status distribution. |
| Orders | Complete | Filter/search, status/payment updates, production detail. |
| Products | Complete | CRUD, gallery, cover, variants, stages/print areas, printing methods. |
| Categories | Complete | CRUD with images. |
| Pricing rules | Complete | Product/method scoped rule management. |
| Customers | Complete | List/search/detail, role and active updates. |
| Templates/cliparts/fonts | Complete | CRUD; template preview generation. |
| Store settings | Complete | Tax, shipping, threshold, announcement, demo mode, Shopify config. |
| Shopify status/sync | Complete | Status, manual sync, webhook log. |

## Backend platform

| Feature | Status | Notes |
| --- | --- | --- |
| JWT auth + roles | Complete | SimpleJWT; custom role permission. |
| Public catalog APIs | Complete | Active-only products/categories; search/sort/filter. |
| Design validation | Complete | Object allowlist, image host rules, size limits. |
| Upload pipeline | Complete | MIME/extension checks, sanitization, limits, throttling. |
| Pricing engine | Complete | Variants, methods, rules, quantity discounts. |
| Cart totals | Complete | Discount, shipping threshold, tax. |
| Order snapshots | Complete | Historical names/prices preserved. |
| PNG/PDF exports | Complete | Pillow renderer at print DPI with warnings. |
| SVG exports | Complete (structural) | Vector export; no server-side rasterization. |
| Celery pipeline | Complete | Inline by default; Redis worker in Compose. |
| Shopify webhooks | Complete | HMAC verification, idempotent event records. |
| Health endpoint | Complete | App + DB check. |
| Admin APIs | Complete | All resources used by the admin UI. |
| Backend tests | Complete | 46 tests pass across auth, catalog, designer, commerce and production. |
| Frontend typecheck/build | Complete | TypeScript and production build pass. |

## Infrastructure and docs

| Item | Status | Notes |
| --- | --- | --- |
| `requirements.txt` | Complete | Pinned direct dependencies. |
| Env templates | Complete | Root (Compose), backend and frontend examples. |
| `.gitignore` | Complete | Python, Node, env, media, test artifacts. |
| Dockerfiles + Compose | Complete (untested locally) | Compose could not be run because the Docker daemon is unavailable on the development machine. |
| README/docs set | Complete | Plan, architecture, API, schema, development, deployment. |
| Playwright E2E | Complete | 9 tests cover storefront, auth, template dragging, studio and admin; 8 pass by default and the dashboard test runs when admin env vars are set. |
| CI pipeline | Not included | Suggested: backend tests, frontend typecheck/build, Playwright. |

## Known limitations / next work

1. **Payments:** checkout is demo-only; integrate Stripe/PayPal and payment webhooks for production.
2. **Media storage:** production media serving/object storage and CDN are documented but not provisioned.
3. **SVG rasterization:** SVG is exported structurally; there is no CairoSVG/headless-browser rasterizer.
4. **E2E coverage:** extend Playwright coverage to checkout, a full editor save/export flow and admin CRUD; the admin dashboard test requires `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`.
5. **Dependency audit:** `npm audit` reports 6 remaining vulnerabilities (4 high, 2 critical): Fabric/canvas/tar XSS-and-archive advisories and Next.js 14 advisories whose fixes require major upgrades (Next 16, Fabric 7). Plan a framework-upgrade milestone before production.
6. **Docker verification:** Compose configuration is authored but not executed locally; validate in CI or on a Docker host.
7. **Django admin branding:** Django’s built-in admin is available, but the product admin experience is the Next.js admin studio.
8. **Rate limits and pagination:** defaults are suitable for demo/small stores; tune for production traffic.
