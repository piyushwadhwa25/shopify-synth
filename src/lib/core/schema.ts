/** Monetary value as returned by the Shopify Admin API. */
export type ShopifyMoney = {
  amount: string;
  currency_code: string;
};

/** Postal address shape used on customers and orders. */
export type ShopifyAddress = {
  first_name: string;
  last_name: string;
  city: string;
  province: string;
  country: string;
  zip: string;
};

/** Customer resource from the Shopify Admin API. */
export type ShopifyCustomer = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  created_at: string;
  default_address: ShopifyAddress;
};

/** Product variant (SKU-level) from the Shopify Admin API. */
export type ShopifyProductVariant = {
  id: number;
  product_id: number;
  title: string;
  price: string;
  inventory_quantity: number;
};

/** Product resource from the Shopify Admin API. */
export type ShopifyProduct = {
  id: number;
  title: string;
  product_type: string;
  status: "active" | "draft" | "archived";
  created_at: string;
  variants: ShopifyProductVariant[];
  tags: string;
};

/** Line item on an order from the Shopify Admin API. */
export type ShopifyLineItem = {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  variant_title: string;
  quantity: number;
  price: string;
  total_discount: string;
};

/** Fulfillment record on an order from the Shopify Admin API. */
export type ShopifyFulfillment = {
  id: number;
  status: "pending" | "open" | "success" | "cancelled" | "error";
  created_at: string;
  tracking_company: string | null;
};

/** Order resource from the Shopify Admin API. */
export type ShopifyOrder = {
  id: number;
  order_number: number;
  created_at: string;
  processed_at: string;
  financial_status:
    | "paid"
    | "pending"
    | "refunded"
    | "partially_refunded"
    | "voided";
  fulfillment_status:
    | "fulfilled"
    | "partial"
    | "unfulfilled"
    | "restocked"
    | null;
  gateway:
    | "cash_on_delivery"
    | "razorpay"
    | "payu"
    | "shopify_payments"
    | "upi";
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  currency: string;
  customer: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress;
  fulfillments: ShopifyFulfillment[];
  tags: string;
  note: string | null;
};

/** Top-level payload returned by the synthetic data generator. */
export type GeneratorOutput = {
  store_id: string;
  scenario: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  seed: number;
  orders: ShopifyOrder[];
  customers: ShopifyCustomer[];
  products: ShopifyProduct[];
};
