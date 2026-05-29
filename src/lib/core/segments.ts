import type { TrendConfig } from "./trend.js";

/** Parameters that can vary per date-bounded segment; unspecified fields inherit from the base profile. */
export interface SegmentParams {
  orders_per_day_mean?: number;
  orders_per_day_std?: number;
  new_customer_rate?: number;
  repeat_purchase_probability?: number;
  cod_rate?: number;
  cod_rto_rate?: number;
  prepaid_refund_rate?: number;
  discount_rate?: number;
  discount_amount_mean?: number;
  aov_mean?: number;
  aov_std?: number;
  weekend_multiplier?: number;
  evening_concentration?: number;
  trend?: TrendConfig;
}

/** A parsed segment row: inclusive date range plus parameter overrides. */
export interface Segment {
  start_date: string;
  end_date: string;
  params: SegmentParams;
}

/** Global generation window and RNG seed; applies to the entire run. */
export interface GlobalPeriod {
  period_start: string;
  period_end: string;
  seed: number;
}

/** Default parameter values for a scenario; segments override only what changes. */
export interface BaseProfile {
  scenario: string;
  store_id: string;
  params: Required<SegmentParams>;
}

/** Fully merged parameters for one day — every field is defined after resolution. */
export type ResolvedParams = Required<SegmentParams>;

const RATE_FIELDS: (keyof SegmentParams)[] = [
  "new_customer_rate",
  "repeat_purchase_probability",
  "cod_rate",
  "cod_rto_rate",
  "prepaid_refund_rate",
  "discount_rate",
  "evening_concentration",
];

const NON_NEGATIVE_FIELDS: (keyof SegmentParams)[] = [
  "orders_per_day_mean",
  "orders_per_day_std",
  "discount_amount_mean",
  "aov_mean",
  "aov_std",
];

/** Returns true when `dateStr` is a valid `YYYY-MM-DD` ISO date. */
function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === dateStr;
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

/** Validates numeric constraints on a partial parameter set. */
function collectParamErrors(
  params: SegmentParams,
  label: string,
): string[] {
  const errors: string[] = [];

  for (const field of RATE_FIELDS) {
    const value = params[field];
    if (typeof value === "number" && (value < 0 || value > 1)) {
      errors.push(`${label}: ${field} must be in [0, 1], got ${value}`);
    }
  }

  for (const field of NON_NEGATIVE_FIELDS) {
    const value = params[field];
    if (typeof value === "number" && value < 0) {
      errors.push(`${label}: ${field} must be >= 0, got ${value}`);
    }
  }

  return errors;
}

/**
 * Finds the segment whose inclusive date range contains `date`.
 * When ranges overlap, the earliest matching segment in the array wins.
 *
 * @param date - ISO date string, e.g. `"2025-06-15"`.
 * @param segments - Parsed segment rows (expected non-overlapping).
 * @returns The active segment, or `null` when no range covers the date.
 */
export function findActiveSegment(
  date: string,
  segments: Segment[],
): Segment | null {
  for (const segment of segments) {
    // ISO `YYYY-MM-DD` strings compare lexicographically in chronological order.
    if (date >= segment.start_date && date <= segment.end_date) {
      return segment;
    }
  }
  return null;
}

/**
 * Merges segment overrides onto base profile parameters.
 * Override values win; base fills any fields the segment does not specify.
 *
 * @param base - Full base profile parameters.
 * @param override - Segment-specific overrides, if any.
 * @returns A complete parameter set with no optional fields.
 */
export function resolveParams(
  base: Required<SegmentParams>,
  override: SegmentParams | undefined,
): ResolvedParams {
  if (!override) {
    return { ...base };
  }
  return { ...base, ...override };
}

/**
 * Builds a day-by-day map of resolved parameters for the generation period.
 * Each date key maps to base profile values merged with the active segment override.
 *
 * @param period_start - Inclusive period start (ISO date).
 * @param period_end - Inclusive period end (ISO date).
 * @param base - Base profile parameters.
 * @param segments - Segment rows to apply when their ranges cover a date.
 */
export function buildDayMap(
  period_start: string,
  period_end: string,
  base: Required<SegmentParams>,
  segments: Segment[],
): Map<string, ResolvedParams> {
  const dayMap = new Map<string, ResolvedParams>();

  for (const date of iterateDatesInclusive(period_start, period_end)) {
    const active = findActiveSegment(date, segments);
    dayMap.set(date, resolveParams(base, active?.params));
  }

  return dayMap;
}

/**
 * Validates segment rows and the global period configuration.
 * Returns an empty array when everything is valid.
 *
 * @param segments - Segment rows to validate.
 * @param globalPeriod - Overall generation window (dates are also validated).
 */
export function validateSegments(
  segments: Segment[],
  globalPeriod: GlobalPeriod,
): string[] {
  const errors: string[] = [];

  if (!isValidISODate(globalPeriod.period_start)) {
    errors.push(
      `globalPeriod.period_start is not a valid ISO date: ${globalPeriod.period_start}`,
    );
  }
  if (!isValidISODate(globalPeriod.period_end)) {
    errors.push(
      `globalPeriod.period_end is not a valid ISO date: ${globalPeriod.period_end}`,
    );
  }
  if (
    isValidISODate(globalPeriod.period_start) &&
    isValidISODate(globalPeriod.period_end) &&
    globalPeriod.period_start > globalPeriod.period_end
  ) {
    errors.push(
      "globalPeriod.period_start must be on or before period_end",
    );
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const label = `segment[${i}] (${segment.start_date} to ${segment.end_date})`;

    if (!isValidISODate(segment.start_date)) {
      errors.push(`${label}: start_date is not a valid ISO date`);
    }
    if (!isValidISODate(segment.end_date)) {
      errors.push(`${label}: end_date is not a valid ISO date`);
    }
    if (
      isValidISODate(segment.start_date) &&
      isValidISODate(segment.end_date) &&
      segment.start_date > segment.end_date
    ) {
      errors.push(`${label}: start_date must be on or before end_date`);
    }

    errors.push(...collectParamErrors(segment.params, label));

    for (let j = i + 1; j < segments.length; j++) {
      const other = segments[j];
      if (
        isValidISODate(segment.start_date) &&
        isValidISODate(segment.end_date) &&
        isValidISODate(other.start_date) &&
        isValidISODate(other.end_date)
      ) {
        // Ranges overlap when each starts on or before the other ends.
        const overlaps =
          segment.start_date <= other.end_date &&
          other.start_date <= segment.end_date;
        if (overlaps) {
          errors.push(
            `segment[${i}] and segment[${j}] have overlapping date ranges`,
          );
        }
      }
    }
  }

  return errors;
}
