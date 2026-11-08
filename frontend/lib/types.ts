export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  product_count: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
}

export interface PrintArea {
  id: string;
  name: string;
  width_mm: string;
  height_mm: string;
  mockup_x: number;
  mockup_y: number;
  mockup_width: number;
  mockup_height: number;
  safe_area_mm: string;
  bleed_mm: string;
  editor_dpi: number;
  export_dpi: number;
  min_dpi: number;
  grid_mm: number;
  shape: string;
  width_px: number;
  height_px: number;
  export_width_px: number;
  export_height_px: number;
}

export interface Stage {
  id: string;
  name: string;
  slug: string;
  mockup_url: string | null;
  mockup_width: number;
  mockup_height: number;
  print_area: PrintArea | null;
  sort_order: number;
}

export interface Variant {
  id: string;
  name: string;
  sku: string;
  color_name: string;
  color_hex: string;
  size: string;
  price_delta: string;
  stock_quantity: number;
  is_active: boolean;
  sort_order: number;
}

export interface PrintingMethod {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_fee: string;
  per_area_fee: string;
  sort_order: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  base_price: string;
  min_price: string;
  compare_at_price: string | null;
  currency: string;
  image_url: string | null;
  category: Category | null;
  is_featured: boolean;
  stage_count: number;
  variant_count: number;
}

export interface Product extends ProductListItem {
  description: string;
  images: ProductImage[];
  variants: Variant[];
  stages: Stage[];
  printing_methods: { id: string; printing_method: PrintingMethod; price_adjustment: string; is_default: boolean }[];
  quantity_discounts: { min_qty: number; percent: string }[];
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  category: string;
  tags: string[];
  description: string;
  preview_url: string | null;
  canvas_json: any;
  price: string;
  product: string | null;
  product_slug: string | null;
  visibility: string;
}

export interface Clipart {
  id: string;
  name: string;
  category: string;
  tags: string[];
  image_url: string;
  thumbnail_url: string;
  price: string;
}

export interface FontResource {
  id: string;
  name: string;
  family: string;
  url: string | null;
  weight: string;
  style: string;
}

export interface Design {
  id: string;
  name: string;
  product: string;
  product_name: string;
  product_slug: string;
  stage: string | null;
  stage_name: string | null;
  preview_url: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  canvas_json?: any;
  metadata?: any;
}

export interface Upload {
  id: string;
  url: string;
  asset_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
}

export interface CartItem {
  id: string;
  product: string;
  product_detail: ProductListItem;
  variant: string | null;
  variant_detail: Variant | null;
  design: string | null;
  design_detail: Design | null;
  printing_method: string | null;
  printing_method_name: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
  configuration: any;
  created_at: string;
}

export interface CartTotals {
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  currency: string;
  free_shipping_threshold: string | null;
}

export interface Cart {
  id: string;
  status: string;
  items: CartItem[];
  item_count: number;
  totals: CartTotals;
  updated_at: string;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
}

export interface Quote {
  product: string;
  variant: string | null;
  printing_method: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  discount: string;
  total: string;
  design_stats: {
    objects: number;
    images: number;
    cliparts: number;
    characters: number;
    lines: number;
    colors: number;
    shapes: number;
    print_areas: number;
  };
  breakdown: { label: string; amount: string }[];
}

export interface OrderListItem {
  id: string;
  number: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  item_count: number;
  customer_email: string;
  created_at: string;
  paid_at: string | null;
}

export interface OrderItem {
  id: string;
  order: string;
  product: string | null;
  product_name: string;
  product_slug: string | null;
  variant: string | null;
  variant_name: string;
  printing_method: string | null;
  printing_method_name: string;
  design: Design | null;
  preview_url: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
  configuration: any;
  exports: GeneratedFile[];
  stage: string | null;
}

export interface Order extends OrderListItem {
  items: OrderItem[];
  email: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  notes: string;
  shopify_order_id: string;
  metadata: any;
  updated_at: string;
}

export interface GeneratedFile {
  id: string;
  design: string;
  design_name: string;
  order_item: string | null;
  stage: string | null;
  stage_name: string | null;
  file_type: string;
  status: string;
  url: string | null;
  dpi: number;
  width_px: number;
  height_px: number;
  size_bytes: number;
  error: string;
  warnings: string[];
  metadata: any;
  created_at: string;
  completed_at: string | null;
}

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "customer" | "admin" | "staff";
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  display_name: string;
  profile: {
    phone: string;
    company: string;
    address: string;
    city: string;
    postal_code: string;
    country: string;
    avatar: string | null;
  } | null;
}

export interface StoreConfig {
  store_name: string;
  currency: string;
  tax_rate: string;
  shipping_fee: string;
  free_shipping_threshold: string | null;
  demo_mode: boolean;
  shopify_domain: string;
  shopify_enabled: boolean;
  shopify_credentials_configured: boolean;
  stripe_configured: boolean;
  announcement: string;
  settings: any;
}

export interface DashboardData {
  products: number;
  active_products: number;
  customers: number;
  designs: number;
  orders: number;
  pending_orders: number;
  revenue: string;
  recent_orders: OrderListItem[];
  recent_designs: Design[];
  orders_by_status: { status: string; count: number }[];
}

export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface AssistantAction {
  label: string;
  href: string;
}

export interface AssistantReply {
  reply: string;
  mode: "ai" | "faq" | "order";
  intent: string;
  authenticated: boolean;
  action: AssistantAction | null;
  suggestions: string[];
}

export interface NewsletterSubscription {
  subscribed: boolean;
  already_subscribed: boolean;
  detail: string;
}
