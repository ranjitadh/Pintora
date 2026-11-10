# Development Guide

## Prerequisites

- Python 3.9+ (3.12 recommended)
- Node.js 20+ and npm
- Optional: PostgreSQL 16, Redis 7, Docker Desktop

## Backend setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver
```

- API: `http://127.0.0.1:8000/api/`
- Health: `http://127.0.0.1:8000/api/health/`
- Django admin: `http://127.0.0.1:8000/admin/`
- SQLite database: `backend/db.sqlite3` (unless `DATABASE_URL` is set)
- Media: `backend/media/`

### Create an admin

`seed_demo` creates an admin only when `DJANGO_ADMIN_EMAIL` and `DJANGO_ADMIN_PASSWORD` are set before it runs:

```bash
cd backend
DJANGO_ADMIN_EMAIL=admin@example.com DJANGO_ADMIN_PASSWORD='strong-password' .venv/bin/python manage.py seed_demo
```

Alternatively:

```bash
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py shell -c "from accounts.models import User; u=User.objects.get(email='admin@example.com'); u.role='admin'; u.save()"
```

Superusers pass the admin-role checks even with the default customer role.

### Seed data

`seed_demo` is idempotent for core records and refreshes demo content with `--force`:

```bash
.venv/bin/python manage.py seed_demo --force
```

It creates categories, products with stages/print areas, printing methods, pricing rules, templates, cliparts, fonts and store configuration. Demo customer credentials come from `DEMO_CUSTOMER_EMAIL` / `DEMO_CUSTOMER_PASSWORD`; if the password is omitted, a random one is generated and printed once.

### Backend tests

```bash
cd backend
.venv/bin/python manage.py test --verbosity=1
```

Test helpers live in `core/testing.py` (`make_user`, `make_product`, `design_payload`, `png_upload`, `TempMediaTestCase`). Media-writing tests use a temporary media root.

### Optional PostgreSQL/Redis

```bash
export DATABASE_URL=postgres://printora:printora@localhost:5432/printora
export CELERY_TASK_ALWAYS_EAGER=false
export CELERY_BROKER_URL=redis://localhost:6379/0
.venv/bin/python manage.py migrate
celery -A config worker --loglevel=info
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Storefront: `http://localhost:3000`.

Create `frontend/.env.local` if the backend is not at `http://127.0.0.1:8000`:

```bash
NEXT_PUBLIC_BACKEND_ORIGIN=http://127.0.0.1:8000
```

Commands:

```bash
npm run typecheck
npm run build
npm run start
```

### Playwright E2E

```bash
cd frontend
npx playwright install chromium   # once
npm run test:e2e
```

The config starts the backend on `127.0.0.1:8000` and Next dev on `127.0.0.1:3100` if they are not already running. It uses the seeded catalog; run `seed_demo` first. Set `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` to enable the admin dashboard test:

```bash
E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD='strong-password' npm run test:e2e
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Required production secret. |
| `DJANGO_DEBUG` | `true` in development; Django serves media only in DEBUG. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated backend hosts. |
| `DATABASE_URL` | PostgreSQL URL; defaults to SQLite. |
| `SITE_URL`, `BACKEND_URL` | Absolute URLs used in integrations. |
| `CORS_ALLOWED_ORIGINS` | Allowed browser origins. |
| `CELERY_TASK_ALWAYS_EAGER` | `true` runs exports inline. |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis broker/result backend. |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Token lifetimes. |
| `MAX_UPLOAD_BYTES` | Upload limit (default 15 MB). |
| `THROTTLE_*` | DRF throttle rates. |
| `SHOPIFY_*` | Shopify credentials and webhook secret. |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | Server-side Next proxy target for `/api` and `/media`. |
| `BACKEND_INTERNAL_URL` | Optional server-only SSR origin; falls back to `NEXT_PUBLIC_BACKEND_ORIGIN`. |
| `NEXT_PUBLIC_SITE_URL` | Public storefront URL used in canonical, Open Graph and JSON-LD metadata. |

## Project map

```text
backend/config/            settings, root URLs, WSGI/Celery
backend/accounts/          auth, profiles, admin customers
backend/catalog/           catalog, stages, variants, printing, pricing rules
backend/designer/          designs, versions, uploads, templates, cliparts, fonts
backend/commerce/          pricing, cart, orders, store config, Shopify, dashboard
backend/production/        renderers, exports, health
backend/core/              shared permissions, pagination, errors, test helpers
frontend/app/              App Router pages
frontend/components/       UI, store chrome, design editor, admin components
frontend/lib/              API client, auth, types, utilities
```

## Common workflows

### Add a product for the editor

1. Create a product in `/admin/products`.
2. Add at least one stage (name, mockup image and dimensions -> print area).
3. Add variants and attach printing methods.
4. Optional: add pricing rules and quantity discounts.
5. Upload gallery images and set a cover.
6. Verify on `/shop` and open the editor from the product page.

### Debug a quote

Use `POST /api/pricing/` directly and inspect `breakdown` and `design_stats`. The same `quote_item` function feeds cart pricing, so a quote mismatch usually points to a rule, variant delta, printing method fee, or quantity-discount tier.

### Debug exports

- With eager Celery, exports complete during the request.
- Otherwise watch the Celery worker log and poll `GET /api/exports/{id}/`.
- Warnings (for example missing images or low-resolution assets) are stored on the record.
- Fonts must exist under `backend/assets/fonts/`.

### Reset local data

```bash
cd backend
rm -f db.sqlite3
rm -rf media
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Images return 404 in development | `DJANGO_DEBUG` is false, or media URL is not under `/media/`. |
| Login loops or 401 | Expired JWT; clear `printora_access`/`printora_refresh` and sign in again. |
| API calls fail from browser | Backend not running, wrong `NEXT_PUBLIC_BACKEND_ORIGIN`, or CORS/allowed-host mismatch. |
| Upload rejected | File type/size, SVG/data-URL restrictions, or upload throttle. |
| Export failed | Missing font/image, no print area, or unsupported object; read `error`/`warnings`. |
| Admin API returns 403 | Token belongs to a customer, not an `admin`/`staff`/superuser. |
| Duplicate stage serializer error | Product must be resolved from the request context (already handled in `AdminStageSerializer`). |
| Path errors running commands | Use the exact repo path with `ranjitadhikari`. |

## Conventions

- Keep pricing and totals server-authoritative; never trust client prices.
- Snapshot display data on order items.
- Scope customer data by owner or admin role.
- Add backend tests for every API behavior change.
- Prefer existing UI primitives and Tailwind tokens over new one-off styles.
- Do not add comments unless they explain non-obvious behavior.
