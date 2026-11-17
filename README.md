# MerchPress

Print-on-demand storefront with a browser design studio, server-authoritative pricing, order management, production file exports, and a staff admin area.

- **Storefront:** catalog, product customization, cart, checkout, order tracking, saved designs and version history.
- **Design studio:** Fabric.js canvas with templates, clipart, fonts, uploads, per-stage print areas, undo/redo, autosave, live quotes and print-ready exports (PNG/SVG/PDF).
- **Admin studio:** dashboard, orders, products, stages/print areas, variants, printing methods, pricing rules, categories, customers, templates/cliparts/fonts, store settings, Shopify sync and webhook events.
- **Backend:** Django 4.2 + Django REST Framework, JWT auth, SQLite or PostgreSQL, inline Celery in development or Redis-backed Celery in Docker.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.12, Django 4.2, DRF 3.15, SimpleJWT, Pillow, Celery |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Fabric.js 5 |
| Data | SQLite (local default) or PostgreSQL 16, Redis 7 for Celery |
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

## Render deployment

`render.yaml` at the repository root provisions the full production stack through Render Blueprints:

- `printora-db` — PostgreSQL 16
- `printora-api` — Django/Gunicorn web service with a 5 GB persistent disk at `/var/data`
- `printora-web` — Next.js frontend that proxies `/api` and `/media` to the backend over Render's private network

The backend service runs `python manage.py migrate --noinput` as a pre-deploy command and `python manage.py seed_if_empty` as its initial deploy hook, so the first deploy creates the six-product demo catalog, database tables, static files, and admin account automatically.

### Quick start

1. Push the deployment commit to `main` (already pushed with `render.yaml`).
2. In the Render Dashboard, choose **New → Blueprint**, connect the GitHub repository, select branch `main`, and path `render.yaml`.
3. When prompted, enter a real `DJANGO_ADMIN_EMAIL` and a strong `DJANGO_ADMIN_PASSWORD`.
4. Click **Deploy Blueprint / Apply**.

Render creates the database, web services, disk, and runs the initial seed. After the deploy:

- Storefront: `https://printora-web.onrender.com`
- API / admin: `https://printora-api.onrender.com`
- Admin login: `https://printora-api.onrender.com/admin/`

Full environment-variable reference, custom-domain steps, media-backup instructions, custom-domain setup, and troubleshooting are in [`docs/RENDER_DEPLOYMENT.md`](docs/RENDER_DEPLOYMENT.md).

### Quick env checklist

Backend (`printora-api`):

| Variable | Value |
| --- | --- |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | 50+ char random secret |
| `DJANGO_ALLOWED_HOSTS` | `.onrender.com,printora-api,printora-web,localhost,127.0.0.1` plus any custom domain |
| `DJANGO_MEDIA_ROOT` | `/var/data/media` |
| `DJANGO_SERVE_MEDIA` | `true` |
| `DATABASE_URL` | from `printora-db` connection string |
| `SITE_URL` | `https://printora-web.onrender.com` |
| `BACKEND_URL` | `https://printora-api.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://printora-web.onrender.com` plus any custom domain |
| `CELERY_TASK_ALWAYS_EAGER` | `true` |
| `DJANGO_ADMIN_EMAIL` | real admin email |
| `DJANGO_ADMIN_PASSWORD` | strong unique password |

Frontend (`printora-web`):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | `https://printora-api.onrender.com` (public) or `http://printora-api:10000` (private, if same region/workspace) |
| `BACKEND_INTERNAL_URL` | same as `NEXT_PUBLIC_BACKEND_ORIGIN` |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://printora-web.onrender.com` |
| `NODE_VERSION` | `20.18.0` |

`NEXT_PUBLIC_BACKEND_ORIGIN` and `NEXT_PUBLIC_SITE_URL` are baked into the Next.js build — redeploy the frontend after changing them.

## Documentation

- [Project plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Development guide](docs/DEVELOPMENT_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT_GUIDE.md)
- [Render deployment guide](docs/RENDER_DEPLOYMENT.md)
- [Feature status](docs/FEATURE_STATUS.md)

## Notes

- Payments are intentionally in demo mode: checkout creates an order without charging a card.
- Uploaded media is served by Django when `DJANGO_DEBUG=true` or `DJANGO_SERVE_MEDIA=true`; use a persistent disk, a web server, or object storage in production.
- JWT access/refresh tokens are stored in HttpOnly cookies. A non-HttpOnly session hint skips auth probes for anonymous visitors, and cookie-authenticated writes require a CSRF token.
- Do not enable `DJANGO_SSL_REDIRECT` while the frontend proxies API/media over Render's private HTTP network; Render terminates TLS at its edge.
- The Deepseek key that appeared in `backend/.env.example` must be rotated before public traffic. Removing it from the tree does not remove it from Git history; rewrite history with `git filter-repo` and force-push only after all collaborators are notified.
- Media files are not stored in Git. Back up both PostgreSQL and the `/var/data` media disk.
