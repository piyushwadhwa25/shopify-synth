import type { GeneratorOutput, ShopifyLineItem, ShopifyOrder } from "../core/schema";
import { synthesizeDiscountCode } from "./discountCodes";
import { synthesizeStreetLine } from "./placeholderAddress";

/**
 * Exact column headers for Shopify Admin Orders → Export CSV
 * (see Shopify Help: Exporting orders).
 */
const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Financial Status",
  "Paid at",
  "Fulfillment Status",
  "Fulfilled at",
  "Accepts Marketing",
  "Currency",
  "Subtotal",
  "Shipping",
  "Taxes",
  "Total",
  "Discount Code",
  "Discount Amount",
  "Shipping Method",
  "Created at",
  "Lineitem quantity",
  "Lineitem name",
  "Lineitem price",
  "Lineitem compare-at price",
  "Lineitem SKU",
  "Lineitem requires shipping",
  "Lineitem taxable",
  "Lineitem fulfillment status",
  "Billing Name",
  "Billing Street",
  "Billing Address1",
  "Billing Address2",
  "Billing Company",
  "Billing City",
  "Billing Zip",
  "Billing Province",
  "Billing Province Name",
  "Billing Country",
  "Billing Phone",
  "Shipping Name",
  "Shipping Street",
  "Shipping Address1",
  "Shipping Address2",
  "Shipping Company",
  "Shipping City",
  "Shipping Zip",
  "Shipping Province",
  "Shipping Province Name",
  "Shipping Country",
  "Shipping Phone",
  "Notes",
  "Note Attributes",
  "Cancelled at",
  "Payment Method",
  "Payment Reference (deprecated)",
  "Payment References",
  "Refunded Amount",
  "Vendor",
  "Outstanding Balance",
  "Employee",
  "Location",
  "Device ID",
  "Id",
  "Tags",
  "Risk Level",
  "Source",
  "Lineitem discount",
  "Tax 1 Name",
  "Tax 1 Value",
  "Tax 2 Name",
  "Tax 2 Value",
  "Tax 3 Name",
  "Tax 3 Value",
  "Tax 4 Name",
  "Tax 4 Value",
  "Tax 5 Name",
  "Tax 5 Value",
  "Payment ID",
  "Payment terms",
  "Next payment due at",
] as const;

/** Column indices that stay populated on continuation rows of a multi-line order. */
const CONTINUATION_COLUMNS = new Set<string>([
  "Lineitem quantity",
  "Lineitem name",
  "Lineitem price",
  "Lineitem compare-at price",
  "Lineitem SKU",
  "Lineitem requires shipping",
  "Lineitem taxable",
  "Lineitem fulfillment status",
  "Vendor",
  "Lineitem discount",
]);

/** Display labels for known `order.gateway` values. */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  razorpay: "Razorpay",
  payu: "PayU",
  upi: "UPI",
};

/**
 * Converts a {@link GeneratorOutput} into Shopify Admin order-export CSV text.
 * One row per line item; order-level columns appear only on the first row of
 * each order (Shopify's native blank-repeat pattern).
 *
 * Pure: reads `output` only — no I/O, DOM, or mutation of generator state.
 *
 * @param output - Synthetic store payload from `generate()`.
 * @returns Full CSV string including header row.
 */
export function toOrderExportCsv(output: GeneratorOutput): string {
  const lines: string[] = [HEADERS.map(escapeCsvField).join(",")];

  for (const order of output.orders) {
    const items = order.line_items;
    if (items.length === 0) {
      lines.push(
        buildOrderRow(order, emptyLineItem(), true)
          .map(escapeCsvField)
          .join(","),
      );
      continue;
    }

    for (let i = 0; i < items.length; i++) {
      const row = buildOrderRow(order, items[i], i === 0);
      lines.push(row.map(escapeCsvField).join(","));
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Builds one CSV row for an order / line-item pair.
 *
 * @param order - Source order.
 * @param lineItem - Line item for this row (may be a stub when the order has none).
 * @param isFirstRow - When false, blank all non-line-item / non-Vendor columns.
 */
function buildOrderRow(
  order: ShopifyOrder,
  lineItem: ShopifyLineItem,
  isFirstRow: boolean,
): string[] {
  const addr = order.shipping_address;
  const fullName = `${addr.first_name} ${addr.last_name}`.trim();
  const street = synthesizeStreetLine(order.customer.id);
  const fulfillmentStatus = order.fulfillment_status ?? "";
  const paidAt =
    order.financial_status === "paid" || order.financial_status === "refunded"
      ? order.processed_at
      : "";
  const discountCode =
    synthesizeDiscountCode(
      parseFloat(order.subtotal_price),
      parseFloat(order.total_discounts),
      order.id,
    ) ?? "";
  const paymentMethod =
    PAYMENT_METHOD_LABELS[order.gateway] ?? order.gateway;
  const refundedAmount =
    order.financial_status === "refunded" ? order.total_price : "0.00";

  const cells: Record<(typeof HEADERS)[number], string> = {
    Name: `#${order.order_number}`,
    Phone: order.customer.phone,
    Email: order.customer.email,
    "Financial Status": order.financial_status,
    "Paid at": paidAt,
    "Fulfillment Status": fulfillmentStatus,
    "Fulfilled at": order.fulfillments[0]?.created_at ?? "",
    "Accepts Marketing": order.customer.buyer_accepts_marketing ? "yes" : "no",
    Currency: order.currency,
    Subtotal: order.subtotal_price,
    Shipping: "0.00",
    Taxes: "0.00",
    Total: order.total_price,
    "Discount Code": discountCode,
    "Discount Amount": order.total_discounts,
    "Shipping Method": "",
    "Created at": order.created_at,
    "Lineitem quantity": String(lineItem.quantity),
    "Lineitem name": formatLineItemName(lineItem),
    "Lineitem price": lineItem.price,
    "Lineitem compare-at price": "",
    "Lineitem SKU": lineItem.sku ?? "",
    "Lineitem requires shipping": "true",
    "Lineitem taxable": "true",
    "Lineitem fulfillment status": fulfillmentStatus,
    "Billing Name": fullName,
    "Billing Street": street,
    "Billing Address1": street,
    "Billing Address2": "",
    "Billing Company": "",
    "Billing City": addr.city,
    "Billing Zip": addr.zip,
    "Billing Province": addr.province,
    "Billing Province Name": addr.province,
    "Billing Country": addr.country,
    "Billing Phone": order.customer.phone,
    "Shipping Name": fullName,
    "Shipping Street": street,
    "Shipping Address1": street,
    "Shipping Address2": "",
    "Shipping Company": "",
    "Shipping City": addr.city,
    "Shipping Zip": addr.zip,
    "Shipping Province": addr.province,
    "Shipping Province Name": addr.province,
    "Shipping Country": addr.country,
    "Shipping Phone": order.customer.phone,
    Notes: "",
    "Note Attributes": "",
    "Cancelled at": "",
    "Payment Method": paymentMethod,
    "Payment Reference (deprecated)": "",
    "Payment References": "",
    "Refunded Amount": refundedAmount,
    Vendor: lineItem.vendor ?? "",
    "Outstanding Balance": "",
    Employee: "",
    Location: "",
    "Device ID": "",
    Id: String(order.id),
    Tags: order.tags,
    "Risk Level": "",
    Source: "web",
    "Lineitem discount": lineItem.total_discount,
    "Tax 1 Name": "",
    "Tax 1 Value": "",
    "Tax 2 Name": "",
    "Tax 2 Value": "",
    "Tax 3 Name": "",
    "Tax 3 Value": "",
    "Tax 4 Name": "",
    "Tax 4 Value": "",
    "Tax 5 Name": "",
    "Tax 5 Value": "",
    "Payment ID": "",
    "Payment terms": "",
    "Next payment due at": "",
  };

  return HEADERS.map((header) => {
    if (!isFirstRow && !CONTINUATION_COLUMNS.has(header)) {
      return "";
    }
    return cells[header];
  });
}

/**
 * Formats a line item display name the way Shopify exports do:
 * `"Title - Variant"` unless the variant is `"Default Title"`.
 */
function formatLineItemName(lineItem: ShopifyLineItem): string {
  if (!lineItem.title) {
    return "";
  }
  if (
    lineItem.variant_title &&
    lineItem.variant_title !== "Default Title"
  ) {
    return `${lineItem.title} - ${lineItem.variant_title}`;
  }
  return lineItem.title;
}

/** Blank line item used when an order somehow has none. */
function emptyLineItem(): ShopifyLineItem {
  return {
    id: 0,
    product_id: 0,
    variant_id: 0,
    title: "",
    variant_title: "",
    quantity: 0,
    price: "",
    total_discount: "",
  };
}

/**
 * Escapes a CSV field per RFC-style rules (quote when the value contains
 * comma, quote, or newline; double embedded quotes).
 */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
