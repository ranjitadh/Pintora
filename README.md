# Printora

Print-on-demand storefront with a browser design studio, server-authoritative pricing, order management, production file exports, and a staff admin area.

- **Storefront:** catalog, product customization, cart, checkout, order tracking, saved designs and version history.
- **Design studio:** Fabric.js canvas with templates, clipart, fonts, uploads, per-stage print areas, undo/redo, autosave, live quotes and print-ready exports (PNG/SVG/PDF).
- **Admin studio:** dashboard, orders, products, stages/print areas, variants, printing methods, pricing rules, categories, customers, templates/cliparts/fonts, store settings, Shopify sync and webhook events.
- **Backend:** Django 4.2 + Django REST Framework, JWT auth, SQLite or PostgreSQL, inline Celery in development or Redis-backed Celery in Docker.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.9+, Django 4.2, DRF 3.15, SimpleJWT, Pillow, Celery |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Fabric.js 5 |
| Data | SQLite (default) or PostgreSQL 16, Redis 7 for Celery |
| Runtime | Node 20, Python 3.12 in Docker |

## Local development

### 1. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver
```

The API runs at `http://127.0.0.1:8000`. Without `DATABASE_URL`, `backend/db.sqlite3` is used. Without Redis, Celery runs jobs inline (`CELERY_TASK_ALWAYS_EAGER` defaults to true in settings when no broker is configured).

Seed an administrator and demo customer by setting `DJANGO_ADMIN_EMAIL` / `DJANGO_ADMIN_PASSWORD` and `DEMO_CUSTOMER_EMAIL` / `DEMO_CUSTOMER_PASSWORD` in `backend/.env` before running `seed_demo`. If the demo customer password is omitted, a random one is printed once. Use `--force` to refresh demo products and settings.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The Next.js server proxies `/api/*` and `/media/*` to `NEXT_PUBLIC_BACKEND_ORIGIN` (default `http://127.0.0.1:8000`). Override it in `frontend/.env.local` if the backend runs elsewhere.

### Useful commands

```bash
cd backend && .venv/bin/python manage.py test --verbosity=1
cd backend && .venv/bin/python manage.py seed_demo --force
cd frontend && npm run typecheck
cd frontend && npm run build
cd frontend && npm run test:e2e   # starts backend + Next dev; run seed_demo first
```

## Docker Compose

```bash
cp .env.example .env
# edit secrets in .env
docker compose up --build -d
# one-time demo content (safe to rerun with --force)
docker compose --profile seed run --rm seed
```

- Storefront: `http://localhost:3000`
- API: `http://localhost:8000/api/`
- Django admin: `http://localhost:8000/admin/`

Inside Compose, `NEXT_PUBLIC_BACKEND_ORIGIN` must be the backend service address (`http://backend:8000`); the root `.env.example` is preset for this. Use `http://localhost:8000` only when running Next.js outside Docker.

## Documentation

- [Project plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Development guide](docs/DEVELOPMENT_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT_GUIDE.md)
- [Feature status](docs/FEATURE_STATUS.md)

## Notes

- Payments are intentionally in demo mode: checkout creates an order without charging a card.
- Uploaded/static media is served by Django only while `DJANGO_DEBUG=true`; put media behind object storage or a web server in production.
- JWT access/refresh tokens are stored in `localStorage` for the SPA-style client. Review this trade-off before exposing the app to high-risk environments.
