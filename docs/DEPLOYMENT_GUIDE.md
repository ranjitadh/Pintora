# Deployment Guide

## Recommended topology

```text
Internet
  │ TLS
  ▼
Reverse proxy (Nginx/Caddy/ALB)
  ├─ /            ─▶ frontend (Next.js, port 3000)
  ├─ /api/        ─▶ backend (Gunicorn, port 8000)
  ├─ /media/      ─▶ shared media volume or object storage/CDN
  └─ /static/     ─▶ WhiteNoise (backend) or CDN
                       │
                       ├─ PostgreSQL
                       └─ Redis ─▶ Celery worker
```

## Docker Compose

```bash
cp .env.example .env
# 1. Set DJANGO_SECRET_KEY and all passwords.
# 2. Set DJANGO_ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS to public hosts.
# 3. For HTTPS deployments, keep DEBUG=false and terminate TLS at the proxy.
# 4. Set NEXT_PUBLIC_BACKEND_ORIGIN to the internal backend address
#    (http://backend:8000) because Next.js performs the rewrites server-side.
docker compose up --build -d
docker compose --profile seed run --rm seed   # optional demo data
```

Services: PostgreSQL, Redis, backend (Gunicorn), Celery, frontend (`next start`), persistent `postgres_data`, `redis_data`, `media_data`, `static_data`.

### Required environment checks

| Variable | Production requirement |
| --- | --- |
| `DJANGO_SECRET_KEY` | Long random value; never the default. |
| `DJANGO_DEBUG` | `false`. |
| `DJANGO_ALLOWED_HOSTS` | Public API host(s), e.g. `api.example.com`; add the container name only for internal probes. |
| `DATABASE_URL` | Managed PostgreSQL or Compose Postgres. |
| `CORS_ALLOWED_ORIGINS` | Exact storefront origin(s), e.g. `https://shop.example.com`. |
| `SITE_URL`, `BACKEND_URL` | Public HTTPS URLs. |
| `CELERY_*` | Redis broker/result URLs; set eager to `false`. |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | Internal backend URL used by Next rewrites; baked at build time, so rebuild after changing it. |
| `SHOPIFY_WEBHOOK_SECRET` | Must match the Shopify webhook signing secret. |

## Media and static files

- **Static:** the backend startup command runs `collectstatic`; WhiteNoise serves compressed static assets.
- **Media:** Django only serves `/media/` when `DJANGO_DEBUG=true`. In production:
  - Mount the `media_data` volume into Nginx and serve `/media/` directly, **or**
  - Switch `DEFAULT_FILE_STORAGE` to S3-compatible storage and front it with a CDN.
- Back up/retain the media volume: designs, mockups, uploads and production exports live there.

## Database

```bash
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py createsuperuser
```

- Do not ship SQLite to production; use PostgreSQL.
- Take regular logical backups (`pg_dump`) and test restores.
- Applied migrations are forward-only; do not edit them in deployed environments.

## Celery

With `CELERY_TASK_ALWAYS_EAGER=false`, a worker must run:

```bash
celery -A config worker --loglevel=info
```

Scale workers independently of web processes. Export records remain in `pending`/`processing` if no worker is running; clients poll `GET /api/exports/{id}/`. Redis persistence is optional but recommended for queued jobs during restarts.

## Reverse proxy requirements

- Forward `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`.
- Set client upload limit above `MAX_UPLOAD_BYTES` (default 15 MB).
- Serve `/media/` from the shared volume (or redirect to object storage).
- Cache immutable Next.js `/_next/static/*` assets.
- Enable HTTPS and HSTS.

Example Nginx fragment:

```nginx
server {
    listen 443 ssl;
    server_name shop.example.com;

    client_max_body_size 20m;

    location /_next/static/ {
        proxy_pass http://frontend:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /media/ {
        alias /srv/printora/media/;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.example.com;

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

If the storefront proxies `/api` and `/media` itself, only the storefront origin needs to be public; keep the API internal.

## Health checks

- `GET /api/health/` — application + database connectivity.
- Use it for container/orchestrator readiness and liveness probes.
- Test frontend by requesting `/` and a static asset.

## Shopify

1. Configure `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_ACCESS_TOKEN`.
2. Set the webhook secret to the Shopify signing secret.
3. Register webhooks to `https://api.example.com/api/shopify/webhooks/` for order topics.
4. Verify delivery under **Admin → Settings** (status + recent webhook events). Events are recorded and processed idempotently.

## Security checklist

- [ ] Strong `DJANGO_SECRET_KEY`; rotate if exposed.
- [ ] `DJANGO_DEBUG=false`.
- [ ] HTTPS only; secure proxy headers.
- [ ] Restrict `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`.
- [ ] Change all seeded/demo credentials; disable or remove demo users.
- [ ] Keep `demo_mode` appropriate for the deployment.
- [ ] Restrict admin access (network policy or SSO proxy) in addition to role checks.
- [ ] Add a Content Security Policy; JWT is stored in `localStorage`.
- [ ] Keep dependencies patched; review `npm audit` and Python advisories.
- [ ] Back up PostgreSQL and media on a schedule; test restores.
- [ ] Configure log aggregation and alerting.

## Scaling notes

- Run multiple Gunicorn workers/containers behind the proxy; keep media shared.
- Scale Celery workers for export-heavy traffic.
- Put PostgreSQL and Redis on managed services for production.
- Move media to object storage + CDN for multi-instance deployments.
- Set `page_size`/throttle rates according to traffic.

## Upgrades

1. Pull code and review migrations.
2. Back up the database and media.
3. Rebuild images (`docker compose build`).
4. Run `migrate` and `collectstatic`.
5. Restart backend, Celery and frontend.
6. Verify health, login, catalog, one quote, one export and one order.
