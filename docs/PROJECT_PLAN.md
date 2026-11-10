# MerchPress — Project Plan

## 1. Goal

Deliver a complete print-on-demand platform where customers can browse products, customize them in a browser design studio, get deterministic server-calculated prices, place orders, and download/track their work, while staff manage catalog, production, customers, pricing and integrations from an admin studio.

## 2. Scope delivered

### Customer storefront
- Home, shop with search/category/sort, product detail, template gallery.
- Fabric.js design editor with per-stage print areas, mockup canvas, templates, clipart, fonts, uploads, snapping/guides, undo/redo.
- Autosave, version history/restore, duplicate, live pricing quote.
- Cart, checkout, order creation and order history/details, account page, saved designs.

### Staff admin
- Role-gated admin studio (`admin`/`staff`/superuser).
- Dashboard metrics and recent activity.
- Order management with status/payment updates and production file access.
- Product CRUD, gallery, cover image, stages/print areas, variants, printing methods, pricing rules, categories.
- Customer listing/detail.
- Template, clipart and font management.
- Store configuration, Shopify status/sync, webhook event log.

### Backend platform
- JWT auth (email/password), registration, profile, admin customer APIs.
- Public catalog with pagination/search/filtering and active-only visibility.
- Design persistence with validation, versioning, preview generation.
- Server-authoritative pricing (variants, printing methods, rules, quantity discounts).
- Cart totals (discount, shipping, tax, free-shipping threshold).
- Order snapshots and production exports at print DPI.
- Shopify webhook verification/idempotency and order linking.
- Throttling, upload limits, MIME/extension checks, structured API errors.

## 3. Milestones

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Backend foundation, auth, catalog models/APIs | Complete |
| 2 | Designer models, validation, uploads, editor APIs | Complete |
| 3 | Pricing, cart, orders, store config | Complete |
| 4 | Production renderers (PNG/SVG/PDF) and Celery pipeline | Complete |
| 5 | Storefront pages and Fabric editor | Complete |
| 6 | Admin studio and admin APIs | Complete |
| 7 | Tests, smoke checks, build/type validation | Complete |
| 8 | Docs, env templates, Docker Compose | Complete |
| 9 | Playwright E2E coverage | Complete |
| 10 | Real payment provider, production media storage | Out of scope |

## 4. Non-goals

- Real payment processing/card capture.
- Multi-tenant storefronts.
- Native mobile apps.
- Server-side SVG rasterization (SVG is exported structurally, raster exports use the Pillow renderer).
- Automated print-vendor routing.

## 5. Acceptance criteria

- A new visitor can register, customize a seeded product, add it to cart and place a demo order.
- Prices shown by the editor quote and cart are computed server-side and agree with order totals.
- Designs validate on save, keep version history and can be exported as production files.
- Staff can manage products and the full configuration needed by the editor and pricing engine.
- Admin endpoints reject non-admin tokens.
- Backend test suite passes; frontend typecheck and production build pass.
- Compose stack starts Postgres, Redis, backend, Celery and frontend with persistent media.
