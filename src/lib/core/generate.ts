import {
  createRNG,
  nextInt,
  nextBool,
  nextNormal,
  pickOne,
  pickWeighted,
  type RNGState,
} from "./rng.js";
import {
  applyTrend,
  applyTrendInt,
  applyTrendClamped,
  type TrendConfig,
} from "./trend.js";
import {
  buildDayMap,
  type BaseProfile,
  type Segment,
  type GlobalPeriod,
  type ResolvedParams,
} from "./segments.js";
import {
  getDayOrderCount,
  generateDayTimestamps,
  type FestivalSpike,
} from "./timestamps.js";
import type {
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyProduct,
  ShopifyProductVariant,
  ShopifyLineItem,
  ShopifyFulfillment,
  ShopifyCollection,
  ShopifyCollectionProduct,
  ShopifyAddress,
  GeneratorOutput,
} from "./schema.js";

/** Full input for a single synthetic data generation run. */
export interface GeneratorInput {
  global: GlobalPeriod;
  base: BaseProfile;
  segments: Segment[];
  spikes: FestivalSpike[];
  catalog: CatalogProduct[];
  collections: CatalogCollection[];
}

/** Simplified product definition supplied by the caller; inflated into `ShopifyProduct`. */
export interface CatalogProduct {
  store_id: string;
  title: string;
  product_type: string;
  price_mean: number;
  price_std: number;
  revenue_share: number;
  variants: string[];
  is_dead?: boolean;
}

/** Collection definition mapping catalog store IDs to a Shopify collection. */
export interface CatalogCollection {
  title: string;
  collection_type: "custom" | "smart";
  product_store_ids: string[];
}

/** Catalog row paired with its inflated Shopify product record. */
interface InflatedCatalogEntry {
  catalog: CatalogProduct;
  product: ShopifyProduct;
}

/** City metadata for plausible Indian shipping addresses. */
interface CityInfo {
  province: string;
  zipPrefix: string;
}

/** Trend-adjusted segment parameters used when generating a single day. */
interface TrendedDayParams {
  ordersPerDayMean: number;
  newCustomerRate: number;
  codRate: number;
  codRtoRate: number;
  prepaidRefundRate: number;
  discountRate: number;
  discountAmountMean: number;
  aovMean: number;
  aovStd: number;
  eveningConcentration: number;
  weekendMultiplier: number;
}

const IST_OFFSET = "+05:30";

const TRACKING_COMPANIES = ["Delhivery", "Shiprocket", "BlueDart"];

const PREPAID_GATEWAYS = ["razorpay", "payu", "upi"] as const;
const PREPAID_GATEWAY_WEIGHTS = [0.5, 0.3, 0.2];

const FIRST_NAMES = [
  "Aarav",
  "Vihaan",
  "Ananya",
  "Isha",
  "Rohan",
  "Priya",
  "Kabir",
  "Meera",
  "Arjun",
  "Sneha",
  "Dev",
  "Kavya",
];

const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Reddy",
  "Iyer",
  "Gupta",
  "Singh",
  "Nair",
  "Mehta",
  "Khan",
  "Das",
  "Joshi",
  "Rao",
];

const CITY_LOOKUP: Record<string, CityInfo> = {
  Mumbai: { province: "Maharashtra", zipPrefix: "400" },
  Delhi: { province: "Delhi", zipPrefix: "110" },
  Bangalore: { province: "Karnataka", zipPrefix: "560" },
  Pune: { province: "Maharashtra", zipPrefix: "411" },
  Hyderabad: { province: "Telangana", zipPrefix: "500" },
  Chennai: { province: "Tamil Nadu", zipPrefix: "600" },
  Jaipur: { province: "Rajasthan", zipPrefix: "302" },
  Lucknow: { province: "Uttar Pradesh", zipPrefix: "226" },
  Ahmedabad: { province: "Gujarat", zipPrefix: "380" },
  Surat: { province: "Gujarat", zipPrefix: "395" },
  Kolkata: { province: "West Bengal", zipPrefix: "700" },
  Chandigarh: { province: "Punjab", zipPrefix: "160" },
  Indore: { province: "Madhya Pradesh", zipPrefix: "452" },
  Nagpur: { province: "Maharashtra", zipPrefix: "440" },
  Kochi: { province: "Kerala", zipPrefix: "682" },
};

const DEFAULT_GEO_DISTRIBUTION: Record<string, number> = {
  Mumbai: 0.14,
  Delhi: 0.12,
  Bangalore: 0.11,
  Pune: 0.08,
  Hyderabad: 0.08,
  Chennai: 0.07,
  Jaipur: 0.06,
  Lucknow: 0.06,
  Ahmedabad: 0.06,
  Surat: 0.05,
  Kolkata: 0.05,
  Chandigarh: 0.04,
  Indore: 0.04,
  Nagpur: 0.04,
  Kochi: 0.04,
};

/**
 * Generates a complete synthetic Shopify store dataset for the given input.
 * Walks the period day by day, resolves segment params, and assembles orders.
 *
 * @param input - Global period, base profile, segments, spikes, catalog, and collections.
 */
export function generate(input: GeneratorInput): GeneratorOutput {
  const { global, base, segments, spikes, catalog, collections } = input;

  // --- 1. SETUP ---
  const rng = createRNG(global.seed);
  const dayMap = buildDayMap(
    global.period_start,
    global.period_end,
    base.params,
    segments,
  );

  let nextProductId = 1;
  let nextVariantId = 1;
  let nextCollectionId = 1;
  let nextOrderId = 1;
  let nextCustomerId = 1;
  let nextLineItemId = 1;
  let nextFulfillmentId = 1;

  const inflatedCatalog: InflatedCatalogEntry[] = catalog.map((item) => {
    const product = inflateCatalogProduct(
      item,
      nextProductId,
      nextVariantId,
      rng,
      global.period_start,
    );
    nextProductId += 1;
    nextVariantId += product.variants.length;
    return { catalog: item, product };
  });

  const storeIdToProductId = new Map<string, number>(
    inflatedCatalog.map(({ catalog: item, product }) => [
      item.store_id,
      product.id,
    ]),
  );

  const products = inflatedCatalog.map(({ product }) => product);

  const { shopifyCollections, collectionProducts } = buildCollections(
    collections,
    storeIdToProductId,
    nextCollectionId,
    global.period_start,
  );

  const customerPool = new Map<number, ShopifyCustomer>();
  const orders: ShopifyOrder[] = [];

  const geoDistribution = getGeoDistribution(base);
  const dayCount = countDaysInclusive(global.period_start, global.period_end);
  const totalDays = Math.max(dayCount - 1, 0);

  // --- 2. WALK DAYS ---
  let dayIndex = 0;
  for (const date of iterateDatesInclusive(
    global.period_start,
    global.period_end,
  )) {
    const params = dayMap.get(date);
    if (!params) {
      dayIndex += 1;
      continue;
    }

    // Apply within-day trend drift to numeric segment parameters.
    const trended = buildTrendedDayParams(dayIndex, totalDays, params, rng);

    // Volume for this day: weekend/festival scaling + daily jitter.
    const orderCount = getDayOrderCount(
      date,
      trended.ordersPerDayMean,
      {
        ...params,
        weekend_multiplier: trended.weekendMultiplier,
        evening_concentration: trended.eveningConcentration,
      },
      spikes,
      rng,
    );

    const timestamps = generateDayTimestamps(date, orderCount, params, rng);

    // Rates use trend direction only — no noise_std.
    // Noise on probability thresholds causes per-order jitter
    // that inflates rates far above profile values.
    const rateTrendConfig = { ...params.trend, noise_std: 0 };

    const dayCodRate = applyTrendClamped(
      dayIndex,
      totalDays,
      params.cod_rate,
      rateTrendConfig,
      rng,
      0,
      1,
    );
    const dayDiscountRate = applyTrendClamped(
      dayIndex,
      totalDays,
      params.discount_rate,
      rateTrendConfig,
      rng,
      0,
      1,
    );
    const dayRefundRate = applyTrendClamped(
      dayIndex,
      totalDays,
      params.prepaid_refund_rate,
      rateTrendConfig,
      rng,
      0,
      1,
    );

    for (const createdAt of timestamps) {
      const city = pickCity(rng, geoDistribution);

      // Customer assignment: new vs returning, with empty-pool fallback.
      let customer: ShopifyCustomer;
      const poolCustomers = Array.from(customerPool.values());
      if (
        poolCustomers.length === 0 ||
        nextBool(rng, trended.newCustomerRate)
      ) {
        customer = createCustomer(nextCustomerId, city, createdAt, rng);
        nextCustomerId += 1;
        customerPool.set(customer.id, customer);
      } else {
        customer = poolCustomers[nextInt(rng, 0, poolCustomers.length - 1)];
      }

      const shippingAddress = buildAddress(
        city,
        customer.first_name,
        customer.last_name,
        rng,
      );

      // Resample line items until subtotal is within 15% above target AOV.
      let lineItems = buildLineItems(
        inflatedCatalog,
        rng,
        nextLineItemId,
        trended.aovMean,
      );
      nextLineItemId += lineItems.length;

      let attempts = 0;
      while (
        sumLineItems(lineItems) > trended.aovMean * 1.15 &&
        attempts < 5
      ) {
        lineItems = buildLineItems(
          inflatedCatalog,
          rng,
          nextLineItemId,
          trended.aovMean,
        );
        nextLineItemId += lineItems.length;
        attempts += 1;
      }

      const subtotal = sumLineItems(lineItems);
      let discountAmount = 0;
      const hasDiscount = nextBool(rng, dayDiscountRate);
      if (hasDiscount) {
        discountAmount = nextNormal(
          rng,
          trended.discountAmountMean,
          trended.discountAmountMean * 0.3,
          0,
          trended.aovMean * 0.5,
        );
      }

      const totalPrice = Math.max(0, subtotal - discountAmount);

      applyDiscountToLineItems(lineItems, discountAmount);

      // Payment path: COD with optional RTO, or weighted prepaid gateways.
      const isCOD = nextBool(rng, dayCodRate);
      let financialStatus: ShopifyOrder["financial_status"] = "paid";
      let fulfillmentStatus: ShopifyOrder["fulfillment_status"] = "fulfilled";
      let gateway: ShopifyOrder["gateway"] = "cash_on_delivery";
      let tags = "";
      let fulfillments: ShopifyFulfillment[] = [];

      if (isCOD) {
        gateway = "cash_on_delivery";
        financialStatus = "pending";

        const isRTO = nextBool(rng, trended.codRtoRate);
        if (isRTO) {
          // RTO: order returned undelivered — tag for downstream eval scenarios.
          fulfillmentStatus = "restocked";
          tags = "rto,cod";
          fulfillments = [
            {
              id: nextFulfillmentId++,
              status: "cancelled",
              created_at: createdAt,
              tracking_company: pickOne(rng, TRACKING_COMPANIES),
            },
          ];
        } else {
          fulfillmentStatus = "fulfilled";
          fulfillments = [
            {
              id: nextFulfillmentId++,
              status: "success",
              created_at: createdAt,
              tracking_company: pickOne(rng, TRACKING_COMPANIES),
            },
          ];
        }
      } else {
        gateway = pickWeighted(
          rng,
          [...PREPAID_GATEWAYS],
          PREPAID_GATEWAY_WEIGHTS,
        );

        if (nextBool(rng, dayRefundRate)) {
          financialStatus = "refunded";
          fulfillmentStatus = "restocked";
        } else {
          financialStatus = "paid";
          fulfillmentStatus = "fulfilled";
          fulfillments = [
            {
              id: nextFulfillmentId++,
              status: "success",
              created_at: createdAt,
              tracking_company: pickOne(rng, TRACKING_COMPANIES),
            },
          ];
        }
      }

      // Keep embedded customer metrics in sync with this order.
      customer.orders_count += 1;
      customer.total_spent = formatMoney(
        parseFloat(customer.total_spent) + totalPrice,
      );
      customer.default_address = { ...shippingAddress };
      customerPool.set(customer.id, customer);

      const order: ShopifyOrder = {
        id: nextOrderId,
        order_number: nextOrderId,
        created_at: createdAt,
        processed_at: createdAt,
        financial_status: financialStatus,
        fulfillment_status: fulfillmentStatus,
        gateway,
        total_price: formatMoney(totalPrice),
        subtotal_price: formatMoney(subtotal),
        total_discounts: formatMoney(discountAmount),
        currency: "INR",
        customer: { ...customer },
        line_items: lineItems,
        shipping_address: shippingAddress,
        fulfillments,
        tags,
        note: null,
      };

      orders.push(order);
      nextOrderId += 1;
    }

    dayIndex += 1;
  }

  // --- 3. ASSEMBLE OUTPUT ---
  return {
    store_id: base.store_id,
    scenario: base.scenario,
    generated_at: new Date().toISOString(),
    period_start: global.period_start,
    period_end: global.period_end,
    seed: global.seed,
    orders,
    customers: Array.from(customerPool.values()),
    products,
    collections: shopifyCollections,
    collection_products: collectionProducts,
  };
}

/** Formats a numeric amount as a Shopify money string with two decimals. */
function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

/** Advances an ISO date string by `days` (UTC-safe). */
function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Yields every ISO date from `start` through `end`, inclusive. */
function* iterateDatesInclusive(
  start: string,
  end: string,
): Generator<string> {
  let current = start;
  while (current <= end) {
    yield current;
    if (current === end) {
      break;
    }
    current = addDays(current, 1);
  }
}

/** Counts inclusive calendar days between two ISO date strings. */
function countDaysInclusive(start: string, end: string): number {
  let count = 0;
  for (const _date of iterateDatesInclusive(start, end)) {
    count += 1;
  }
  return count;
}

/** Reads optional geographic weights from the base profile or falls back to defaults. */
function getGeoDistribution(base: BaseProfile): Record<string, number> {
  const extended = base as BaseProfile & {
    geographic_distribution?: Record<string, number>;
  };
  return extended.geographic_distribution ?? DEFAULT_GEO_DISTRIBUTION;
}

/** Applies trend interpolation to the segment params used during order generation. */
function buildTrendedDayParams(
  dayIndex: number,
  totalDays: number,
  params: ResolvedParams,
  rng: RNGState,
): TrendedDayParams {
  const trend = params.trend;
  // noise_std is for order-volume jitter only — not applied to [0, 1] rate fields.
  const rateTrend: TrendConfig = { ...trend, noise_std: undefined };

  return {
    ordersPerDayMean: applyTrendInt(
      dayIndex,
      totalDays,
      params.orders_per_day_mean,
      trend,
      rng,
    ),
    newCustomerRate: applyTrendClamped(
      dayIndex,
      totalDays,
      params.new_customer_rate,
      rateTrend,
      rng,
      0,
      1,
    ),
    codRate: applyTrendClamped(
      dayIndex,
      totalDays,
      params.cod_rate,
      rateTrend,
      rng,
      0,
      1,
    ),
    codRtoRate: applyTrendClamped(
      dayIndex,
      totalDays,
      params.cod_rto_rate,
      rateTrend,
      rng,
      0,
      1,
    ),
    prepaidRefundRate: applyTrendClamped(
      dayIndex,
      totalDays,
      params.prepaid_refund_rate,
      rateTrend,
      rng,
      0,
      1,
    ),
    discountRate: applyTrendClamped(
      dayIndex,
      totalDays,
      params.discount_rate,
      rateTrend,
      rng,
      0,
      1,
    ),
    discountAmountMean: applyTrend(
      dayIndex,
      totalDays,
      params.discount_amount_mean,
      trend,
      rng,
    ),
    aovMean: applyTrend(dayIndex, totalDays, params.aov_mean, trend, rng),
    aovStd: applyTrend(dayIndex, totalDays, params.aov_std, trend, rng),
    eveningConcentration: applyTrendClamped(
      dayIndex,
      totalDays,
      params.evening_concentration,
      rateTrend,
      rng,
      0,
      1,
    ),
    weekendMultiplier: applyTrend(
      dayIndex,
      totalDays,
      params.weekend_multiplier,
      trend,
      rng,
    ),
  };
}

/**
 * Samples a city name from weighted geographic distribution keys.
 * Only cities present in both the distribution and lookup table are eligible.
 */
function pickCity(
  rng: RNGState,
  geoDistribution: Record<string, number>,
): string {
  const cities = Object.keys(geoDistribution).filter(
    (city) => city in CITY_LOOKUP,
  );
  const weights = cities.map((city) => geoDistribution[city]);
  if (cities.length === 0) {
    return pickOne(rng, Object.keys(CITY_LOOKUP));
  }
  return pickWeighted(rng, cities, weights);
}

/** Builds a plausible Indian address for the given city and recipient name. */
function buildAddress(
  city: string,
  firstName: string,
  lastName: string,
  rng: RNGState,
): ShopifyAddress {
  const info = CITY_LOOKUP[city] ?? CITY_LOOKUP.Mumbai;
  // Zip prefix (3 digits) + random suffix (3 digits) → 6-digit Indian PIN code.
  const zipSuffix = String(nextInt(rng, 0, 999)).padStart(3, "0");
  const zip = `${info.zipPrefix}${zipSuffix}`;

  return {
    first_name: firstName,
    last_name: lastName,
    city,
    province: info.province,
    country: "India",
    zip,
  };
}

/**
 * Creates a new customer with synthetic name, email, and default address.
 * Address city matches the order shipping city for consistency.
 */
function createCustomer(
  id: number,
  city: string,
  createdAt: string,
  rng: RNGState,
): ShopifyCustomer {
  const firstName = pickOne(rng, FIRST_NAMES);
  const lastName = pickOne(rng, LAST_NAMES);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${id}@example.com`;

  return {
    id,
    email,
    first_name: firstName,
    last_name: lastName,
    orders_count: 0,
    total_spent: "0.00",
    created_at: createdAt,
    default_address: buildAddress(city, firstName, lastName, rng),
  };
}

/**
 * Inflates a catalog row into a full Shopify product with variants and inventory.
 */
function inflateCatalogProduct(
  catalogProduct: CatalogProduct,
  productId: number,
  startingVariantId: number,
  rng: RNGState,
  periodStart: string,
): ShopifyProduct {
  const createdAt = `${periodStart}T00:00:00${IST_OFFSET}`;
  const variants: ShopifyProductVariant[] = catalogProduct.variants.map(
    (title, index) => {
      const price = nextNormal(
        rng,
        catalogProduct.price_mean,
        catalogProduct.price_std,
        1,
      );
      return {
        id: startingVariantId + index,
        product_id: productId,
        title,
        price: formatMoney(price),
        inventory_quantity: nextInt(rng, 20, 500),
      };
    },
  );

  return {
    id: productId,
    title: catalogProduct.title,
    product_type: catalogProduct.product_type,
    status: catalogProduct.is_dead ? "draft" : "active",
    created_at: createdAt,
    variants,
    tags: catalogProduct.store_id,
  };
}

/** Builds Shopify collections and join rows from catalog collection definitions. */
function buildCollections(
  catalogCollections: CatalogCollection[],
  storeIdToProductId: Map<string, number>,
  startingCollectionId: number,
  periodStart: string,
): {
  shopifyCollections: ShopifyCollection[];
  collectionProducts: ShopifyCollectionProduct[];
} {
  const shopifyCollections: ShopifyCollection[] = [];
  const collectionProducts: ShopifyCollectionProduct[] = [];
  const createdAt = `${periodStart}T00:00:00${IST_OFFSET}`;

  catalogCollections.forEach((collection, index) => {
    const collectionId = startingCollectionId + index;
    const productIds = collection.product_store_ids
      .map((storeId) => storeIdToProductId.get(storeId))
      .filter((productId): productId is number => productId !== undefined);

    shopifyCollections.push({
      id: collectionId,
      title: collection.title,
      collection_type: collection.collection_type,
      products_count: productIds.length,
      created_at: createdAt,
      published_at: createdAt,
    });

    productIds.forEach((productId, position) => {
      collectionProducts.push({
        collection_id: collectionId,
        product_id: productId,
        position: position + 1,
      });
    });
  });

  return { shopifyCollections, collectionProducts };
}

/** Picks 1–3 catalog products (without replacement) weighted by revenue share. */
function pickCatalogEntries(
  inflatedCatalog: InflatedCatalogEntry[],
  rng: RNGState,
  aovMean: number,
): InflatedCatalogEntry[] {
  const maxItems = Math.min(3, inflatedCatalog.length);
  const countOptions = [1, 2, 3].filter((n) => n <= maxItems);
  const countWeights = [0.7, 0.22, 0.08].slice(0, countOptions.length);
  const itemCount =
    aovMean > 2000
      ? 1
      : pickWeighted(rng, countOptions, countWeights);
  const available = [...inflatedCatalog];
  const selected: InflatedCatalogEntry[] = [];

  for (let i = 0; i < itemCount && available.length > 0; i++) {
    const weights = available.map((entry) =>
      entry.catalog.is_dead ? 0.001 : entry.catalog.revenue_share,
    );
    const picked = pickWeighted(
      rng,
      available,
      weights,
    ) as InflatedCatalogEntry;
    selected.push(picked);
    available.splice(available.indexOf(picked), 1);
  }

  return selected;
}

/** Builds line items for one order from weighted catalog picks. */
function buildLineItems(
  inflatedCatalog: InflatedCatalogEntry[],
  rng: RNGState,
  startingLineItemId: number,
  aovMean: number,
): ShopifyLineItem[] {
  if (inflatedCatalog.length === 0) {
    return [];
  }

  const picks = pickCatalogEntries(inflatedCatalog, rng, aovMean);

  return picks.map((entry, index) => {
    const variant = pickOne(rng, entry.product.variants);
    const quantity = nextBool(rng, 0.15) ? 2 : 1;
    const priceMean = entry.catalog.price_mean;
    const unitPrice = nextNormal(
      rng,
      priceMean,
      priceMean * 0.08,
      priceMean * 0.5,
      priceMean * 1.5,
    );

    return {
      id: startingLineItemId + index,
      product_id: entry.product.id,
      variant_id: variant.id,
      title: entry.product.title,
      variant_title: variant.title,
      quantity,
      price: formatMoney(unitPrice),
      total_discount: "0.00",
    };
  });
}

/** Sums line item extended prices (price × quantity). */
function sumLineItems(lineItems: ShopifyLineItem[]): number {
  return lineItems.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0,
  );
}

/** Allocates order-level discount to the first line item for Shopify-shaped output. */
function applyDiscountToLineItems(
  lineItems: ShopifyLineItem[],
  discountAmount: number,
): void {
  if (lineItems.length === 0 || discountAmount <= 0) {
    return;
  }
  lineItems[0].total_discount = formatMoney(discountAmount);
}
