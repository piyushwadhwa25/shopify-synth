import type { CatalogProduct, CatalogVariant } from "../core/generate";

/**
 * Result of parsing a Shopify product export CSV into generator catalog rows.
 */
export interface CatalogParseResult {
  /** Parsed products ready for {@link generate}'s `input.catalog`. */
  catalog: CatalogProduct[];
  /** Non-blocking issues (missing prices, empty result, duplicate SKUs, etc.). */
  warnings: string[];
}

/** Accumulator for one Handle group while scanning CSV rows. */
interface ProductDraft {
  handle: string;
  title: string;
  productType: string;
  vendor: string;
  variants: { title: string; sku: string; price: number; inventory: number }[];
}

/**
 * Parses a Shopify Admin product export CSV into {@link CatalogProduct} rows.
 *
 * Groups rows by Handle (one product per handle), skips image-only rows
 * (empty Variant SKU), and builds object variants with SKUs. Product numeric
 * IDs are not present here — they are assigned later during catalog inflation.
 *
 * @param raw - Full CSV text (Shopify Products → Export format).
 * @param storeId - Value written to every product's `store_id`; defaults to `"custom-store"`.
 */
export function parseProductCSV(
  raw: string,
  storeId?: string,
): CatalogParseResult {
  const resolvedStoreId = storeId && storeId.length > 0 ? storeId : "custom-store";
  const warnings: string[] = [];
  const rows = parseCsvRows(raw);

  if (rows.length === 0) {
    warnings.push("empty catalog after parsing");
    return { catalog: [], warnings };
  }

  const header = rows[0].map((h) => h.trim());
  const col = buildColumnIndex(header);

  const required = [
    "Handle",
    "Title",
    "Vendor",
    "Type",
    "Option1 Value",
    "Option2 Value",
    "Variant SKU",
    "Variant Price",
    "Variant Inventory Qty",
  ] as const;

  for (const name of required) {
    if (col[name] === undefined) {
      warnings.push(`missing column "${name}" — treating values as empty`);
    }
  }

  const drafts = new Map<string, ProductDraft>();
  const handleOrder: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const rowNum = i + 1;
    const handle = cell(cells, col, "Handle");
    if (!handle) {
      continue;
    }

    let draft = drafts.get(handle);
    if (!draft) {
      draft = {
        handle,
        title: "",
        productType: "",
        vendor: "",
        variants: [],
      };
      drafts.set(handle, draft);
      handleOrder.push(handle);
    }

    const title = cell(cells, col, "Title");
    if (title && !draft.title) {
      draft.title = title;
    }

    const vendor = cell(cells, col, "Vendor");
    if (vendor && !draft.vendor) {
      draft.vendor = vendor;
    }

    const type = cell(cells, col, "Type");
    if (type && !draft.productType) {
      draft.productType = type;
    }

    const sku = cell(cells, col, "Variant SKU");
    if (!sku) {
      // Image-only or non-variant row.
      continue;
    }

    const option1 = cell(cells, col, "Option1 Value");
    const option2 = cell(cells, col, "Option2 Value");
    const variantTitle = buildVariantTitle(option1, option2);

    const priceRaw = cell(cells, col, "Variant Price");
    const { value: price, invalid: priceInvalid, empty: priceEmpty } =
      parseNumber(priceRaw);
    if (priceEmpty || priceInvalid) {
      warnings.push(
        `row ${rowNum} (handle "${handle}"): missing or invalid Variant Price — defaulted to 0`,
      );
    }

    const inventoryRaw = cell(cells, col, "Variant Inventory Qty");
    const { value: inventory } = parseNumber(inventoryRaw);

    draft.variants.push({
      title: variantTitle,
      sku,
      price,
      inventory,
    });
  }

  const catalog: CatalogProduct[] = [];
  const skuOwners = new Map<string, string>();

  for (const handle of handleOrder) {
    const draft = drafts.get(handle);
    if (!draft || draft.variants.length === 0) {
      continue;
    }

    const prices = draft.variants.map((v) => v.price);
    const priceMean = mean(prices);
    const priceStd =
      prices.length >= 2 ? stdev(prices) : priceMean * 0.08;

    const allZeroInventory = draft.variants.every((v) => v.inventory === 0);

    const variants: CatalogVariant[] = draft.variants.map((v) => ({
      title: v.title,
      sku: v.sku,
    }));

    for (const v of draft.variants) {
      const prior = skuOwners.get(v.sku);
      if (prior !== undefined && prior !== handle) {
        warnings.push(
          `duplicate SKU "${v.sku}" on handles "${prior}" and "${handle}"`,
        );
      } else {
        skuOwners.set(v.sku, handle);
      }
    }

    const product: CatalogProduct = {
      store_id: resolvedStoreId,
      title: draft.title || handle,
      product_type: draft.productType || "General",
      price_mean: priceMean,
      price_std: priceStd,
      revenue_share: 0,
      variants,
      vendor: draft.vendor,
    };

    if (allZeroInventory) {
      product.is_dead = true;
    }

    catalog.push(product);
  }

  if (catalog.length === 0) {
    warnings.push("empty catalog after parsing");
    return { catalog, warnings };
  }

  const share = 1 / catalog.length;
  for (const product of catalog) {
    product.revenue_share = share;
  }

  warnings.push(
    `revenue_share defaulted to uniform across ${catalog.length} products — edit the parsed catalog if you know actual sales split`,
  );

  return { catalog, warnings };
}

/** Builds a variant title from Option1 / Option2 values. */
function buildVariantTitle(option1: string, option2: string): string {
  if (option1 && option2) {
    return `${option1} / ${option2}`;
  }
  if (option1) {
    return option1;
  }
  if (option2) {
    return option2;
  }
  return "Default";
}

/** Maps header names to column indices (exact Shopify export names). */
function buildColumnIndex(header: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) {
    const name = header[i].replace(/^\uFEFF/, "");
    if (index[name] === undefined) {
      index[name] = i;
    }
  }
  return index;
}

/** Reads a cell by column name; empty string when missing. */
function cell(
  cells: string[],
  col: Record<string, number>,
  name: string,
): string {
  const i = col[name];
  if (i === undefined || i >= cells.length) {
    return "";
  }
  return cells[i].trim();
}

/**
 * Safe numeric parse: invalid or empty → 0.
 *
 * @returns `empty` when the raw string was blank; `invalid` when non-empty but NaN.
 */
function parseNumber(raw: string): {
  value: number;
  empty: boolean;
  invalid: boolean;
} {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { value: 0, empty: true, invalid: false };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { value: 0, empty: false, invalid: true };
  }
  return { value, empty: false, invalid: false };
}

/** Arithmetic mean of a non-empty number list. */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n − 1); caller must pass 2+ values. */
function stdev(values: number[]): number {
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Quote-aware CSV split into rows of cells (handles commas and newlines
 * inside quoted fields, and `""` escapes).
 */
function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];

    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          cellValue += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cellValue += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ",") {
      row.push(cellValue);
      cellValue = "";
      continue;
    }

    if (c === "\r") {
      continue;
    }

    if (c === "\n") {
      row.push(cellValue);
      cellValue = "";
      if (row.some((part) => part.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cellValue += c;
  }

  row.push(cellValue);
  if (row.some((part) => part.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}
