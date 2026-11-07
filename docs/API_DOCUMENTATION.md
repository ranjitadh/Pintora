# API Reference

Base URL: `http://127.0.0.1:8000/api` (frontend proxies `/api`). Endpoints use trailing slashes; the Next.js rewrite normalizes proxy requests.

## Conventions

### Authentication
Send JWT access tokens as:

```http
Authorization: Bearer <access_token>
```

Login: `POST /api/auth/login/` with `{ "email": "...", "password": "..." }` → `{ "access", "refresh", "user" }`.
Refresh: `POST /api/auth/refresh/` with `{ "refresh": "..." }` → `{ "access" }`.

### Pagination
Paginated lists return:

```json
{ "count": 24, "page": 1, "page_size": 12, "total_pages": 2, "results": [] }
```

Use `?page=` and `?page_size=` (max 100). Categories, printing methods, templates, cliparts and fonts are unpaginated.

### Errors
DRF errors are normalized:

```json
{
  "detail": "Human-readable message",
  "code": "invalid",
  "status": 400,
  "errors": { "field": ["..."] }
}
```

### Uploads
Multipart uploads use `multipart/form-data`. The default size limit is 15 MB (`MAX_UPLOAD_BYTES`). Upload throttling applies.

## Public endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health/` | Service/database health. |
| GET | `/api/categories/` | Active categories with `product_count`; detail by slug. |
| GET | `/api/products/` | Paginated active products. Filters: `search`/`q`, `category` (slug), `featured=1`, `sort=newest\|oldest\|price_asc\|price_desc\|name\|name_desc`. |
| GET | `/api/products/{slug}/` | Product detail: gallery, variants, stages/print area, printing methods. |
| GET | `/api/printing-methods/` | Active printing methods. |
| GET | `/api/templates/` | Public active templates. Filters: `category`, `search`. |
| GET | `/api/cliparts/` | Active cliparts. Filters: `category`, `search`. |
| GET | `/api/fonts/` | Active font resources. |
| GET | `/api/store/config/` | Public store name, currency, tax/shipping, announcement. |
| POST | `/api/pricing/` | Quote an item (see below). |
| POST | `/api/shopify/webhooks/` | Shopify HMAC-verified webhook endpoint. |

### Quote request

```json
{
  "product": "<product-uuid>",
  "variant": "<variant-uuid-or-null>",
  "printing_method": "<method-uuid-or-null>",
  "design": "<design-uuid-or-null>",
  "quantity": 2
}
```

Returns `currency`, `quantity`, `unit_price`, `subtotal`, `discount_percent`, `discount`, `total`, `breakdown[]`, and `design_stats`.

## Account endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register/` | Public | `email`, `first_name`, `last_name`, `password`, `password_confirm`. |
| POST | `/api/auth/login/` | Public | Returns tokens + user. |
| POST | `/api/auth/refresh/` | Public | Refresh access token. |
| GET/PATCH | `/api/auth/me/` | User | Current user and nested profile. |
| GET | `/api/auth/admin/customers/` | Admin | Paginated customer list; search supported. |
| GET/PATCH | `/api/auth/admin/customers/{id}/` | Admin | Customer detail and role/active updates. |

## Design endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/designs/` | User | Own designs (admins see all); filter by `product`, `stage`, `status`. |
| POST | `/api/designs/` | User | `product`, `stage`, `name`, `canvas_json`, optional `status`, `metadata`; creates version 1 and preview. |
| GET/PATCH/DELETE | `/api/designs/{id}/` | Owner/Admin | Update creates a new version. |
| POST | `/api/designs/{id}/autosave/` | Owner/Admin | Saves canvas/name/stage without creating a version. |
| GET | `/api/designs/{id}/versions/` | Owner/Admin | Recent versions. |
| POST | `/api/designs/{id}/versions/{version_id}/restore/` | Owner/Admin | Restore a version (creates a new version). |
| POST | `/api/designs/{id}/duplicate/` | Owner/Admin | Copy design. |
| POST | `/api/uploads/` | User | Multipart `file`; returns asset URL/dimensions. |

## Commerce endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/cart/` | User | Active cart with lines and totals. |
| DELETE | `/api/cart/` | User | Clear cart. |
| POST | `/api/cart/items/` | User | `product`, optional `variant`, `design`, `printing_method`, `quantity`. Returns full cart. |
| PATCH/DELETE | `/api/cart/items/{id}/` | User | Update quantity / remove line. |
| GET | `/api/orders/` | User | Own orders; optional `status`. |
| POST | `/api/orders/` | User | Checkout current cart. |
| GET | `/api/orders/{id}/` | Owner/Admin | Order detail with items and exports. |

Checkout body:

```json
{
  "shipping_name": "Ada Lovelace",
  "shipping_address": "12 Analytical Way",
  "shipping_city": "London",
  "shipping_postal_code": "N1 1AA",
  "shipping_country": "GB",
  "shipping_phone": "",
  "email": "ada@example.com",
  "notes": "",
  "demo": true
}
```

Order totals are computed server-side from the cart; the client cannot set prices.

## Production endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/exports/create/` | User/Admin | `design` or `order_item`, optional `stage`, `file_type` (`png`, `svg`, `pdf`), `dpi` 72–600. Customers are limited to PNG at ≤150 DPI. |
| GET | `/api/exports/{id}/` | Owner/Admin | Poll status, dimensions, warnings and download URL. |
| GET | `/api/exports/` | User | Own exports; filters `design`, `order_item`. |

Exports run inline in development or via Celery. `status` progresses `pending → processing → completed|failed`.

## Admin endpoints

All require role `admin`, `staff`, or superuser.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/dashboard/` | Counts, revenue, recent orders/designs, orders by status. |
| GET/PATCH | `/api/admin/orders/` / `{id}/` | List (filter `status`, `search`) and update status/payment/notes. |
| GET | `/api/admin/orders/{id}/production/` | Production view with downloadable item payloads. |
| CRUD | `/api/admin/products/` | Search list, create/update/delete; multipart image upload. |
| GET/POST | `/api/admin/products/{id}/images/` | Gallery list/upload. |
| DELETE | `/api/admin/products/{id}/images/{image_id}/` | Delete gallery image. |
| POST | `/api/admin/products/{id}/set-cover/` | `{ "image_id": "..." }`. |
| GET/POST | `/api/admin/products/{id}/stages/` | List/create stages with print-area fields. |
| GET/POST | `/api/admin/products/{id}/printing-methods/` | List/attach methods (`printing_method`, `price_adjustment`, `is_default`). |
| DELETE | `/api/admin/products/{id}/printing-methods/{link_id}/` | Detach method. |
| CRUD | `/api/admin/stages/` | `product`, `name`, sizes, mockup image, print-area fields. |
| GET/PATCH | `/api/admin/stages/{id}/print-area/` | Read/update print area. |
| CRUD | `/api/admin/variants/` | Product variants. |
| CRUD | `/api/admin/printing-methods/` | Method catalog. |
| CRUD | `/api/admin/pricing-rules/` | Product/method-scoped rules. |
| CRUD | `/api/admin/categories/` | Categories; multipart image. |
| CRUD | `/api/admin/templates/` | Multipart `canvas_json`/`tags` strings accepted; preview auto-generated. |
| CRUD | `/api/admin/cliparts/` | Multipart image upload. |
| CRUD | `/api/admin/fonts/` | Font files. |
| GET/PATCH | `/api/admin/store/config/` | Store name, currency, tax, shipping, Shopify, announcement. |
| GET | `/api/admin/shopify/status/` | Configuration status. |
| POST | `/api/admin/shopify/sync/` | Manual order sync. |
| GET | `/api/admin/webhooks/` | Recent webhook events. |

## Health

`GET /api/health/` returns application and database status, and is suitable for container/orchestrator probes.
