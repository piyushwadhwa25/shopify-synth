import { estimateAov } from "./aovEstimate";
import type { CatalogProduct } from "./generate";
import type {
  DayParamSnapshot,
  GeneratorOutput,
  ShopifyOrder,
} from "./schema";
import type { SegmentParams } from "./segments";

/**
 * One Expected vs Actual comparison row for a single generation parameter.
 */
export interface ComparisonRow {
  /** Human label, e.g. `"COD rate"`. */
  param: string;
  /** Raw SegmentParams / PARAM_DESCRIPTIONS key when applicable. */
  paramKey?: string;
  expected: number;
  actual: number;
  /** `actual - expected`. */
  difference: number;
  unit: "rate" | "currency" | "count";
  withinTolerance: boolean;
  /** Optional caveat (e.g. stdev approximation, missing instrumentation). */
  note?: string;
  /** When true, status is reference-only (not a pass/fail target). */
  informational?: boolean;
}

type DayParamNumericKey = Exclude<keyof DayParamSnapshot, "date">;

/**
 * Compares live generation targets (from instrumentation) to actual
 * statistics measured on {@link GeneratorOutput}.
 *
 * @param output - Generated dataset (requires `dayParams` / `branchCounters`).
 * @param inputParams - Base params used for the run (weekend / evening Expected).
 * @param catalog - Product catalog used for the derived-AOV estimate row.
 * @returns One row per comparable param, or a single diagnostic row if
 *   the dataset lacks Layer-1 instrumentation.
 */
export function compareParams(
  output: GeneratorOutput,
  inputParams: Required<SegmentParams>,
  catalog: CatalogProduct[],
): ComparisonRow[] {
  if (!output.dayParams || !output.branchCounters) {
    return [
      {
        param: "Comparison unavailable",
        expected: NaN,
        actual: NaN,
        difference: NaN,
        unit: "count",
        withinTolerance: false,
        note: "This dataset predates comparison tooling — regenerate to see Expected vs Actual",
      },
    ];
  }

  const dayParams = output.dayParams;
  const branchCounters = output.branchCounters;
  const ordersByDate = groupOrdersByDate(output.orders);
  const periodDates = dayParams.map((d) => d.date);
  const dailyCounts = periodDates.map(
    (date) => ordersByDate.get(date)?.length ?? 0,
  );
  const totalOrders = output.orders.length;

  const rows: ComparisonRow[] = [];

  // 3. orders_per_day_mean — simple mean of day targets; actual = orders / days
  {
    const expected = mean(dayParams.map((d) => d.orders_per_day_mean));
    const actual =
      periodDates.length > 0 ? totalOrders / periodDates.length : NaN;
    rows.push(
      makeRow("Orders per day mean", expected, actual, "count", {
        paramKey: "orders_per_day_mean",
      }),
    );
  }

  // 4. orders_per_day_std — law of total variance (within-day noise + between-day means)
  {
    // dayParams.orders_per_day_mean is already weekend/festival-adjusted.
    const withinDayVariance = weightedDayValues(
      dayParams,
      ordersByDate,
      totalOrders,
      (d) => d.orders_per_day_std ** 2,
    );
    const dayMeans = dayParams.map((d) => d.orders_per_day_mean);
    const meanOfMeans = mean(dayMeans);
    const betweenDayVariance = mean(
      dayMeans.map((m) => (m - meanOfMeans) ** 2),
    );
    const expected = Math.sqrt(withinDayVariance + betweenDayVariance);
    const actual = populationStdev(dailyCounts);
    rows.push(
      makeRow("Orders per day std", expected, actual, "count", {
        paramKey: "orders_per_day_std",
        note: "Accounts for weekend and festival variance, not just day-to-day sampling noise",
      }),
    );
  }

  // 5. new_customer_rate
  {
    // Effective new-customer rate isn't new_customer_rate alone -- a customer that fails the repeat-purchase gate also becomes new. This mirrors the two-stage logic in generate.ts's customer assignment.
    const expected = weightedDayValues(
      dayParams,
      ordersByDate,
      totalOrders,
      (day) =>
        day.new_customer_rate +
        (1 - day.new_customer_rate) *
          (1 - day.repeat_purchase_probability),
    );
    const newCount = output.orders.filter(
      (o) => o.customer.orders_count === 1,
    ).length;
    const actual = totalOrders > 0 ? newCount / totalOrders : NaN;
    rows.push(
      makeRow("New customer rate", expected, actual, "rate", {
        paramKey: "new_customer_rate",
      }),
    );
  }

  // 6. repeat_purchase_probability
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "repeat_purchase_probability",
      totalOrders,
    );
    let actual: number;
    let note: string | undefined;
    if (branchCounters.repeat_branch_attempts === 0) {
      actual = NaN;
      note = "no repeat-eligible customers in this run";
    } else {
      actual =
        branchCounters.repeat_branch_successes /
        branchCounters.repeat_branch_attempts;
    }
    rows.push(
      makeRow("Repeat purchase probability", expected, actual, "rate", {
        paramKey: "repeat_purchase_probability",
        note,
      }),
    );
  }

  // 7. cod_rate
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "cod_rate",
      totalOrders,
    );
    const codCount = output.orders.filter(
      (o) => o.gateway === "cash_on_delivery",
    ).length;
    const actual = totalOrders > 0 ? codCount / totalOrders : NaN;
    rows.push(
      makeRow("COD rate", expected, actual, "rate", {
        paramKey: "cod_rate",
      }),
    );
  }

  // 8. cod_rto_rate
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "cod_rto_rate",
      totalOrders,
    );
    const codOrders = output.orders.filter(
      (o) => o.gateway === "cash_on_delivery",
    );
    let actual: number;
    let note: string | undefined;
    if (codOrders.length === 0) {
      actual = NaN;
      note = "no COD orders in this run";
    } else {
      const rtoCount = codOrders.filter((o) =>
        o.tags.split(",").map((t) => t.trim()).includes("rto"),
      ).length;
      actual = rtoCount / codOrders.length;
    }
    rows.push(
      makeRow("COD RTO rate", expected, actual, "rate", {
        paramKey: "cod_rto_rate",
        note,
      }),
    );
  }

  // 9. prepaid_refund_rate
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "prepaid_refund_rate",
      totalOrders,
    );
    const prepaidOrders = output.orders.filter(
      (o) => o.gateway !== "cash_on_delivery",
    );
    let actual: number;
    let note: string | undefined;
    if (prepaidOrders.length === 0) {
      actual = NaN;
      note = "no prepaid orders in this run";
    } else {
      const refunded = prepaidOrders.filter(
        (o) => o.financial_status === "refunded",
      ).length;
      actual = refunded / prepaidOrders.length;
    }
    rows.push(
      makeRow("Prepaid refund rate", expected, actual, "rate", {
        paramKey: "prepaid_refund_rate",
        note,
      }),
    );
  }

  // 10. discount_rate
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "discount_rate",
      totalOrders,
    );
    const discounted = output.orders.filter(
      (o) => parseFloat(o.total_discounts) > 0,
    ).length;
    const actual = totalOrders > 0 ? discounted / totalOrders : NaN;
    rows.push(
      makeRow("Discount rate", expected, actual, "rate", {
        paramKey: "discount_rate",
      }),
    );
  }

  // 11. discount_amount_mean
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "discount_amount_mean",
      totalOrders,
    );
    const discountedOrders = output.orders.filter(
      (o) => parseFloat(o.total_discounts) > 0,
    );
    let actual: number;
    let note: string | undefined;
    if (discountedOrders.length === 0) {
      actual = NaN;
      note = "no discounted orders in this run";
    } else {
      actual = mean(
        discountedOrders.map((o) => parseFloat(o.total_discounts)),
      );
    }
    rows.push(
      makeRow("Discount amount mean", expected, actual, "currency", {
        paramKey: "discount_amount_mean",
        note,
      }),
    );
  }

  // 12. items_per_order_mean
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "items_per_order_mean",
      totalOrders,
    );
    const actual =
      totalOrders > 0
        ? mean(output.orders.map((o) => o.line_items.length))
        : NaN;
    rows.push(
      makeRow("Items per order mean", expected, actual, "count", {
        paramKey: "items_per_order_mean",
      }),
    );
  }

  // 13. multi_unit_rate
  {
    const expected = weightedDayAverage(
      dayParams,
      ordersByDate,
      "multi_unit_rate",
      totalOrders,
    );
    const allLineItems = output.orders.flatMap((o) => o.line_items);
    const actual =
      allLineItems.length > 0
        ? allLineItems.filter((li) => li.quantity >= 2).length /
          allLineItems.length
        : NaN;
    rows.push(
      makeRow("Multi-unit rate", expected, actual, "rate", {
        paramKey: "multi_unit_rate",
      }),
    );
  }

  // 13b. AOV (derived) — informational, not a direct input target
  {
    const itemsMean = weightedDayAverage(
      dayParams,
      ordersByDate,
      "items_per_order_mean",
      totalOrders,
    );
    const multiRate = weightedDayAverage(
      dayParams,
      ordersByDate,
      "multi_unit_rate",
      totalOrders,
    );
    const expected = estimateAov(catalog, itemsMean, multiRate);
    const actual =
      totalOrders > 0
        ? mean(output.orders.map((o) => parseFloat(o.total_price)))
        : NaN;
    rows.push(
      makeRow("AOV (derived)", expected, actual, "currency", {
        note: "AOV is derived from your catalog and basket params. It isn't a direct input, shown here for reference.",
        informational: true,
      }),
    );
  }

  // 14. weekend_multiplier — flat Expected from input
  {
    const expected = inputParams.weekend_multiplier;
    const weekendCounts: number[] = [];
    const weekdayCounts: number[] = [];
    for (let i = 0; i < periodDates.length; i++) {
      const dow = new Date(periodDates[i]).getDay();
      if (dow === 0 || dow === 6) {
        weekendCounts.push(dailyCounts[i]);
      } else {
        weekdayCounts.push(dailyCounts[i]);
      }
    }
    const avgWeekend =
      weekendCounts.length > 0 ? mean(weekendCounts) : NaN;
    const avgWeekday =
      weekdayCounts.length > 0 ? mean(weekdayCounts) : NaN;
    let actual: number;
    let note: string | undefined;
    if (
      !Number.isFinite(avgWeekday) ||
      avgWeekday === 0 ||
      !Number.isFinite(avgWeekend)
    ) {
      actual = NaN;
      note = "insufficient weekend/weekday days to compute ratio";
    } else {
      actual = avgWeekend / avgWeekday;
    }
    rows.push(
      makeRow("Weekend multiplier", expected, actual, "count", {
        paramKey: "weekend_multiplier",
        note,
      }),
    );
  }

  // 15. evening_concentration — flat Expected from input
  {
    const expected = inputParams.evening_concentration;
    const eveningCount = output.orders.filter((o) => {
      const hour = hourFromIstTimestamp(o.created_at);
      return hour >= 18 && hour < 23;
    }).length;
    const actual = totalOrders > 0 ? eveningCount / totalOrders : NaN;
    rows.push(
      makeRow("Evening concentration", expected, actual, "rate", {
        paramKey: "evening_concentration",
      }),
    );
  }

  return rows;
}

/**
 * Builds a comparison row with difference and tolerance flags.
 *
 * @param param - Human-readable parameter label.
 * @param expected - Target / weighted expected value.
 * @param actual - Measured value from output.
 * @param unit - Unit used for tolerance rules.
 * @param extras - Optional note and/or raw `paramKey`.
 */
function makeRow(
  param: string,
  expected: number,
  actual: number,
  unit: ComparisonRow["unit"],
  extras?: {
    note?: string;
    paramKey?: string;
    informational?: boolean;
  },
): ComparisonRow {
  const difference = actual - expected;
  return {
    param,
    expected,
    actual,
    difference,
    unit,
    withinTolerance: isWithinTolerance(expected, actual, difference, unit),
    ...(extras?.note !== undefined ? { note: extras.note } : {}),
    ...(extras?.paramKey !== undefined ? { paramKey: extras.paramKey } : {}),
    ...(extras?.informational !== undefined
      ? { informational: extras.informational }
      : {}),
  };
}

/**
 * Tolerance check for Expected vs Actual.
 *
 * - rate: |diff| ≤ 0.03
 * - currency / count: |diff| ≤ 15% of |expected|
 */
function isWithinTolerance(
  expected: number,
  actual: number,
  difference: number,
  unit: ComparisonRow["unit"],
): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return false;
  }
  const absDiff = Math.abs(difference);
  if (unit === "rate") {
    return absDiff <= 0.03;
  }
  const bound = Math.abs(expected) * 0.15;
  return absDiff <= bound;
}

/**
 * Order-count-weighted average of a per-day numeric value.
 * Days with zero orders contribute weight 0 (target recorded, no skew).
 */
function weightedDayValues(
  dayParams: DayParamSnapshot[],
  ordersByDate: Map<string, ShopifyOrder[]>,
  totalOrders: number,
  valueOf: (day: DayParamSnapshot) => number,
): number {
  if (totalOrders <= 0 || dayParams.length === 0) {
    return NaN;
  }
  let weightedSum = 0;
  for (const day of dayParams) {
    const weight = ordersByDate.get(day.date)?.length ?? 0;
    weightedSum += valueOf(day) * weight;
  }
  return weightedSum / totalOrders;
}

/**
 * Order-count-weighted average of a dayParams field.
 * Days with zero orders contribute weight 0 (target recorded, no skew).
 */
function weightedDayAverage(
  dayParams: DayParamSnapshot[],
  ordersByDate: Map<string, ShopifyOrder[]>,
  field: DayParamNumericKey,
  totalOrders: number,
): number {
  return weightedDayValues(
    dayParams,
    ordersByDate,
    totalOrders,
    (day) => day[field],
  );
}

/** Groups orders by the `YYYY-MM-DD` prefix of `created_at`. */
function groupOrdersByDate(
  orders: ShopifyOrder[],
): Map<string, ShopifyOrder[]> {
  const map = new Map<string, ShopifyOrder[]>();
  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    const list = map.get(date);
    if (list) {
      list.push(order);
    } else {
      map.set(date, [order]);
    }
  }
  return map;
}

/**
 * Reads the hour from an IST timestamp string without timezone conversion.
 * Expects `YYYY-MM-DDTHH:mm:ss+05:30` (as produced by timestamps.ts).
 */
function hourFromIstTimestamp(iso: string): number {
  const tIndex = iso.indexOf("T");
  if (tIndex < 0 || iso.length < tIndex + 3) {
    return NaN;
  }
  return parseInt(iso.slice(tIndex + 1, tIndex + 3), 10);
}

/** Arithmetic mean of a non-empty number list; `NaN` if empty. */
function mean(values: number[]): number {
  if (values.length === 0) {
    return NaN;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation (divide by N); `NaN` if empty. */
function populationStdev(values: number[]): number {
  if (values.length === 0) {
    return NaN;
  }
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
