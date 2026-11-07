# Architecture

## High level

```text
Browser
  │
  ├─ Next.js 14 (storefront, editor, admin)
  │    ├─ /api/*    ──rewrite──▶ Django REST API
  │    ├─ /media/*  ──rewrite──▶ Django media (DEBUG) / object storage
  │    └─ /fonts/*  ──static───▶ frontend/public/fonts
  │
  └─ Django REST API
       ├─ accounts   JWT auth, profile, admin customers
       ├─ catalog    products, stages/print areas, variants, printing methods, pricing rules
       ├─ designer   designs, versions, uploads, templates, cliparts, fonts
       ├─ commerce   pricing, cart, orders, store config, Shopify, admin dashboard
       └─ production render/export pipeline (PNG/SVG/PDF)
              ├─ inline execution (development)
              └─ Celery + Redis (Docker/production)
                     └─ PostgreSQL or SQLite
```

The frontend never computes authoritative prices. The editor requests `/api/pricing/` quotes, and the backend recalculates when items enter the cart and again when an order is placed.

## Backend applications

| App | Responsibility |
| --- | --- |
| `accounts` | Email-based `User` with role, profile, JWT login/refresh, admin customer APIs. |
| `catalog` | Categories, products, gallery, variants, printing methods, product links, stages, print areas, pricing rules. |
| `designer` | Design documents, version history, sanitized uploads, templates, cliparts, fonts. |
| `commerce` | Pricing engine, cart, checkout/orders, store configuration, dashboard, Shopify. |
| `production` | Generated-file records, renderers, export endpoints, health check. |
| `core` | Permissions, pagination, API exception envelope, test helpers. |

### Auth and permissions
- JWT access/refresh tokens are issued by `/api/auth/login/` and refreshed at `/api/auth/refresh/`.
- Public catalog and store configuration are `AllowAny`; customer designs, cart, orders and exports are owner-scoped.
- `IsAdminRole` permits superusers and users with role `admin` or `staff`.
- `IsOwnerOrAdmin` checks `user`/`owner` attributes on objects.
- DRF throttles: anonymous, authenticated user, auth endpoints, uploads.

### Design document
`Design.canvas_json` holds a structured Fabric.js document:

```json
{
  "version": "5.3.0",
  "stages": {
    "<stage-uuid>": {
      "width": 1000,
      "height": 1200,
      "objects": ["... Fabric.js object dictionaries ..."]
    }
  }
}
```

A flat canvas is also accepted. `designer/validation.py` enforces allowed object types, blocks data URLs and non-allowlisted image hosts, limits object count/size, and extracts the canvas for a stage. Uploads are extension/MIME checked, size-limited, raster-normalized where needed, and SVGs are sanitized before storage.

### Pricing flow
`commerce/pricing.py`:
1. Start at `Product.base_price`.
2. Add variant `price_delta`.
3. Add printing-method `base_fee + per_area_fee × print_areas` plus product-method `price_adjustment`.
4. Apply active global/product `PricingRule`s (quantity, areas, images, cliparts, characters, lines, colors, designs, shapes, variants, base surcharge).
5. Multiply by quantity.
6. Apply the best matching quantity-discount tier.
7. Return unit price, subtotal, discount, total, breakdown and design statistics.

Cart totals then apply discount, shipping (free above the store threshold), and tax. Orders snapshot names, unit prices, totals and configuration so catalog edits do not mutate history.

### Production exports
`production/render.py` is an independent Pillow renderer for the supported Fabric subset (text, textbox, images, shapes, groups, rotation, scale, opacity). Export dimensions come from print-area millimeters and requested DPI:
- **PNG** — raster at print DPI with DPI metadata and low-resolution warnings.
- **PDF** — RGB PDF generated from the PNG.
- **SVG** — structural vector export with sanitized embedded images; SVG is not rasterized server-side.

`GeneratedFile` tracks status, dimensions, size, warnings and metadata. `production/services.py` runs inline when `CELERY_TASK_ALWAYS_EAGER=true` (default), otherwise through Celery.

### Shopify
`POST /api/shopify/webhooks/` verifies the HMAC with `SHOPIFY_WEBHOOK_SECRET`, records every event in `WebhookEvent`, processes orders idempotently, and links `Order.shopify_order_id`. Admin endpoints expose status, manual sync and recent events.

### Media
- Development/Compose demo: Django serves `/media/` only when `DJANGO_DEBUG=true`.
- Production: WhiteNoise serves collected static files; serve media via Nginx, S3-compatible storage or a CDN.
- The frontend converts any absolute URL whose path starts with `/media/` into a relative path, so images work through the Next.js proxy regardless of backend host.

## Frontend architecture

```text
frontend/
  app/            App Router pages (public, auth, account, admin)
  components/     UI primitives, store chrome, Fabric editor, admin components
  lib/            API client, auth context, types, utilities
  public/fonts/   Editor font files
```

- `lib/api.ts`: fetch wrapper, JWT headers, refresh on 401, error normalization, media URLs.
- `lib/auth.tsx`: `localStorage`-backed session, login/register/logout, `isAdmin`, cart refresh event.
- `components/design-editor.tsx`: lazy-loads Fabric, maps one canvas across product stages, tracks per-stage JSON, autosaves, quotes, adds to cart and requests exports.
- `app/admin/layout.tsx`: role gate and responsive admin navigation.
- Styling: Tailwind CSS with shared primitives in `components/ui.tsx`.

## Runtime topology

- **Development:** Next dev server + Django runserver + SQLite + inline Celery.
- **Compose:** Next `next start`, Gunicorn, PostgreSQL 16, Redis 7, Celery worker, persistent media/static volumes. Add Nginx/TLS for production.

## Constraints

- Python 3.9 compatibility for local dev; Docker uses Python 3.12.
- No server-side SVG rasterization (no CairoSVG dependency).
- Demo-only payments; checkout does not capture funds.
- JWT lives in `localStorage`; use a strict CSP and consider httpOnly cookies for higher-security deployments.
