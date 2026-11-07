# Database Schema

UUID primary keys are used for catalog/business entities; users and webhook events use Django defaults. All major timestamps are UTC (`USE_TZ=true`). `created_at`/`updated_at` come from the shared `TimeStampedModel`.

## accounts

### `accounts_user` (extends `AbstractUser`)
| Column | Type | Notes |
| --- | --- | --- |
| id | bigint PK | Auto. |
| email | varchar unique | Login identifier. |
| username | varchar unique | Defaults to email. |
| first_name, last_name | varchar | Display name. |
| password | varchar | Django hash. |
| role | varchar | `customer` (default), `admin`, `staff`. |
| is_active, is_staff, is_superuser | bool | Django flags. |
| date_joined, last_login | timestamps | Django. |

### `accounts_userprofile`
`user` one-to-one → user; `phone`, `company`, `address`, `city`, `postal_code`, `country`, `avatar`.

## catalog

### `catalog_productcategory`
`id` UUID, `name`, `slug` unique, `description`, `image`, `sort_order`, `is_active`, timestamps.
Relationships: `products` reverse FK.

### `catalog_product`
`id`, `category` FK (PROTECT, nullable), `name`, `slug` unique, `short_description`, `description`, `base_price`, `compare_at_price`, `currency`, `image`, `is_active`, `is_featured`, `quantity_discounts` JSON (`[{min_qty, percent}]`), `metadata` JSON, `created_by` FK user (SET_NULL), timestamps.
Relationships: `images`, `variants`, `stages`, `printing_method_links`, `pricing_rules`, designs, cart/order items.

### `catalog_productimage`
`id`, `product` FK (CASCADE), `image`, `alt`, `sort_order`.

### `catalog_productvariant`
`id`, `product` FK, `name`, `sku`, `color_name`, `color_hex`, `size`, `price_delta`, `stock_quantity`, `is_active`, `sort_order`.
Constraint: unique product + name.

### `catalog_printingmethod`
`id`, `name`, `slug` unique, `description`, `base_fee`, `per_area_fee`, `is_active`, `sort_order`.

### `catalog_productprintingmethod`
Join table: `id`, `product` FK, `printing_method` FK, `price_adjustment`, `is_default`.
Constraint: unique product + printing method.

### `catalog_printarea`
One-to-one with stage. `name`, `width_mm`, `height_mm`, `mockup_x`, `mockup_y`, `mockup_width`, `mockup_height`, `safe_area_mm`, `bleed_mm`, `editor_dpi`, `export_dpi`, `min_dpi`, `grid_mm`, `shape` (`rectangle`/`rounded`).

### `catalog_productstage`
`id`, `product` FK, `name`, `slug`, `mockup_image`, `mockup_width`, `mockup_height`, `print_area` one-to-one (CASCADE), `sort_order`, `is_active`.
Constraint: unique product + slug.

### `catalog_pricingrule`
`id`, `product` FK nullable, `printing_method` FK nullable, `rule_type`, `amount`, `description`, `config` JSON, `is_active`.
`rule_type`: `base_surcharge`, `per_quantity`, `per_print_area`, `per_image`, `per_clipart`, `per_character`, `per_line`, `per_color`, `per_design`, `per_shape`, `per_variant`.

## designer

### `designer_designtemplate`
`id`, `name`, `slug` unique, `category`, `tags` JSON, `description`, `product` FK nullable, `preview_image`, `canvas_json` JSON, `price`, `is_active`, `visibility` (`public`/`private`).
Constraint: unique product + slug.

### `designer_clipart`
`id`, `name`, `category`, `tags` JSON, `image`, `thumbnail`, `price`, `is_active`, `sort_order`.

### `designer_fontresource`
`id`, `name`, `family`, `file`, `weight`, `style`, `is_active`, `sort_order`.

### `designer_design`
`id`, `user` FK, `product` FK, `stage` FK nullable, `name`, `canvas_json` JSON, `preview_image`, `status` (`draft`/`saved`/`ordered`), `version`, `metadata` JSON, timestamps.
Relationships: `versions`, `generated_files`, cart/order items.

### `designer_designversion`
`id`, `design` FK, `version`, `canvas_json`, `preview_image`, `created_by` FK nullable, `created_at`.
Constraint: unique design + version.

### `designer_designasset`
`id`, `user` FK, `design` FK nullable, `file`, `asset_type` (`upload`/`clipart`/`mockup`/`preview`/`font`), `original_name`, `mime_type`, `size_bytes`, `width`, `height`, timestamps.

## commerce

### `commerce_cart`
`id`, `user` FK, `status` (`active`/`converted`), timestamps. Index on user + status.

### `commerce_cartitem`
`id`, `cart` FK, `product` FK, `variant` FK nullable, `design` FK nullable, `printing_method` FK nullable, `quantity`, `unit_price`, `line_total`, `configuration` JSON.

### `commerce_order`
`id`, `number` unique, `user` FK (PROTECT), `status` (`pending`, `paid`, `processing`, `ready_for_production`, `printing`, `completed`, `cancelled`), `payment_status` (`unpaid`, `demo`, `paid`, `refunded`), `currency`, `subtotal`, `discount`, `shipping`, `tax`, `total`, shipping fields, `email`, `notes`, `shopify_order_id` (indexed), `metadata` JSON, `paid_at`, timestamps.

### `commerce_orderitem`
`id`, `order` FK, `product` FK (SET_NULL), `variant` FK nullable, `design` FK nullable, `printing_method` FK nullable, snapshot names, `quantity`, `unit_price`, `line_total`, `preview_image`, `configuration` JSON.

### `commerce_storeconfiguration`
Singleton (`id=1`): `store_name`, `currency`, `tax_rate`, `shipping_fee`, `free_shipping_threshold`, `demo_mode`, `shopify_domain`, `shopify_enabled`, `announcement`, `settings` JSON.

### `commerce_webhookevent`
`id`, `topic`, `external_id`, `payload` JSON, `verified`, `processed`, `error`, `created_at`.

## production

### `production_generatedfile`
`id`, `design` FK, `order_item` FK nullable, `stage` FK nullable, `requested_by` FK nullable, `file_type` (`png`/`svg`/`pdf`/`preview`), `file`, `status` (`pending`/`processing`/`completed`/`failed`), `dpi`, `width_px`, `height_px`, `size_bytes`, `error`, `warnings` JSON, `metadata` JSON, `completed_at`, timestamps.

## Relationship summary

```text
User 1─* Design 1─* DesignVersion
User 1─* Cart 1─* CartItem *─1 Product
User 1─* Order 1─* OrderItem *─1 Product
Design 1─* GeneratedFile *─1 ProductStage
ProductCategory 1─* Product 1─* ProductStage 1─1 PrintArea
Product 1─* ProductVariant
Product *─* PrintingMethod (ProductPrintingMethod)
Product 1─* PricingRule
Product 1─* DesignTemplate
OrderItem 1─* GeneratedFile
```

## Migrations

Migrations live in each app’s `migrations/` directory. Run `python manage.py migrate` after pulling changes; never edit applied migrations in shared environments.
