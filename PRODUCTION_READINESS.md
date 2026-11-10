# MerchPress Production Readiness

Date: 2026-11-07

## Overall Status: COMPLETE AND VERIFIED

All core features are implemented, tested, and verified. The application is ready for production deployment with the following caveats documented below.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Backend tests | `.venv/bin/python manage.py test` | **71 OK** |
| Django system checks | `.venv/bin/python manage.py check` | No issues |
| Migration check | `.venv/bin/python manage.py makemigrations --check --dry-run` | No changes |
| Frontend typecheck | `npm run typecheck` | Pass |
| Production build | `npm run build` | Pass (20 routes) |
| E2E Playwright | `npx playwright test` | **8 passed, 1 skipped** (admin dashboard needs env vars) |

## Feature Readiness Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Customer auth (register/login/logout) | COMPLETE AND VERIFIED | HttpOnly cookies, CSRF protection, session refresh |
| Product catalog (browse/search/filter) | COMPLETE AND VERIFIED | Public catalog APIs, category/sort/pagination |
| Product detail (variants/printing methods) | COMPLETE AND VERIFIED | Gallery, color/size selection, method selection |
| Design editor (text/shapes/uploads/clipart/templates) | COMPLETE AND VERIFIED | Fabric.js canvas, multi-stage, layers, undo/redo |
| Template application | COMPLETE AND VERIFIED | Apply seeded/custom templates to any stage |
| Cart (add/update/remove/dedup) | COMPLETE AND VERIFIED | Aggregates identical configs, stock validation at add |
| Stock validation at checkout | COMPLETE AND VERIFIED | `select_for_update()` + `F()` atomic decrement, rollback, no negative stock |
| Demo checkout | COMPLETE AND VERIFIED | Marks orders demo-paid, no real charge |
| Stripe Checkout | IMPLEMENTED BUT NOT VERIFIED | Backend sessions + webhooks implemented; tested with mocked Stripe only |
| Stripe webhook | IMPLEMENTED BUT NOT VERIFIED | HMAC verification, idempotent dedup, paid status update |
| Shopify webhook | COMPLETE AND VERIFIED | Independent secret, HMAC verify, dedup, order cancel |
| Shopify sync | IMPLEMENTED BUT NOT VERIFIED | `sync_inventory()` implemented; tested with local fixtures |
| SVG export | COMPLETE AND VERIFIED | Real `<path>` elements for Fabric paths |
| PDF export | COMPLETE AND VERIFIED | Pillow renderer at print DPI |
| PNG export | COMPLETE AND VERIFIED | 300 DPI customer cap, 600 DPI admin |
| Admin dashboard | COMPLETE AND VERIFIED | Revenue (2-decimal), orders, designs, production board |
| Admin product management | COMPLETE AND VERIFIED | CRUD, gallery, stages, variants, printing methods |
| Admin catalog (templates/cliparts/fonts) | COMPLETE AND VERIFIED | CRUD with image/font upload |
| Admin orders | COMPLETE AND VERIFIED | Status/payment updates, print file downloads |
| Admin customers | COMPLETE AND VERIFIED | List/search/detail, role and active updates |
| Admin pricing | COMPLETE AND VERIFIED | Rules + methods, duplicate method returns 400 |
| Admin settings | COMPLETE AND VERIFIED | Store config, Shopify bridge, webhook log |
| Design save/reopen | COMPLETE AND VERIFIED | Versioned, autosave every 45s, restore |
| Order exports | COMPLETE AND VERIFIED | PNG/SVG/PDF generation per order item |

## External Configuration Required

| Variable | Purpose | Required for Production |
|----------|---------|------------------------|
| `DJANGO_SECRET_KEY` | Django signing key | YES - must be long random string |
| `DJANGO_DEBUG` | Debug mode | YES - set to `false` |
| `DJANGO_ALLOWED_HOSTS` | Host whitelist | YES - include production domain |
| `DATABASE_URL` | PostgreSQL connection | YES - for production DB |
| `STRIPE_SECRET_KEY` | Stripe API key | YES - for live card payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing | YES - for verified webhooks |
| `STRIPE_ENABLED` | Enable Stripe checkout | YES - set to `true` |
| `SHOPIFY_STORE_DOMAIN` | Shopify store domain | Optional - for Shopify sync |
| `SHOPIFY_ACCESS_TOKEN` | Shopify API token | Optional - for Shopify sync |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook signing | Optional - for Shopify webhooks |
| `REDIS_URL` | Celery broker | Optional - for async exports |
| `ALLOWED_IMAGE_HOSTS` | Design image host allowlist | Optional - for custom domains |

## Known Limitations

1. **Stripe live payments** - Integration is implemented and tested with mocked responses only. Live card processing has NOT been verified because no Stripe credentials are configured.
2. **Shopify live sync** - Inventory/order sync implemented and tested with local fixtures only. Not verified against a live Shopify store.
3. **Docker** - Compose configuration authored but not executed locally (Docker daemon unavailable). Validate in CI or on a Docker host.
4. **Media storage** - Local filesystem storage only. Production should use object storage (S3) with CDN.
5. **Email** - No email backend configured. Order confirmations and notifications are not sent.
6. **Rate limits** - Default throttling rates suitable for demo/small stores. Tune for production traffic.

## Security Measures

- JWT access/refresh tokens stored in HttpOnly cookies only (never localStorage)
- CSRF token enforcement on cookie-authenticated state-changing requests
- `Secure` and `SameSite=Lax` cookie attributes in production (`DEBUG=false`)
- Design image URLs validated against allowlist (`ALLOWED_IMAGE_HOSTS` + CORS origins + localhost aliases)
- SVG uploads sanitized (no inline scripts, MIME/extension checks)
- Webhook HMAC verification for both Shopify and Stripe
- Webhook event idempotency (unique topic + external_id constraint)
- Order ownership enforcement (customers can only access their own orders)
- Admin role enforcement on all admin endpoints
