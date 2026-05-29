import { nextInt, type RNGState } from "./rng.js";
import type { ResolvedParams } from "./segments.js";

/** Festival or sale window that multiplies daily order volume. */
export interface FestivalSpike {
  start_date: string;
  end_date: string;
  multiplier: number;
  label: string;
}

/** IST offset used for all generated order timestamps. */
const IST_OFFSET = "+05:30";

/**
 * Returns true when `date` falls within a spike's inclusive date window.
 *
 * @param date - ISO date string, e.g. `"2025-11-01"`.
 * @param spike - Festival spike definition.
 */
export function isInFestivalWindow(
  date: string,
  spike: FestivalSpike,
): boolean {
  // ISO `YYYY-MM-DD` strings compare lexicographically in chronological order.
  return date >= spike.start_date && date <= spike.end_date;
}

/**
 * Returns the active festival multiplier for a date.
 * When multiple spikes overlap, the highest multiplier wins.
 *
 * @param date - ISO date string.
 * @param spikes - Festival spike definitions.
 * @returns Multiplier value; `1.0` when no spike is active.
 */
export function getFestivalMultiplier(
  date: string,
  spikes: FestivalSpike[],
): number {
  let multiplier = 1.0;

  for (const spike of spikes) {
    if (isInFestivalWindow(date, spike)) {
      multiplier = Math.max(multiplier, spike.multiplier);
    }
  }

  return multiplier;
}

/**
 * Computes the order count for a single day after weekend and festival scaling,
 * then applies Poisson-like daily variance around the adjusted mean.
 *
 * @param date - ISO date string for the day.
 * @param baseMean - Trend-adjusted `orders_per_day_mean` from the caller.
 * @param params - Resolved segment parameters (weekend multiplier).
 * @param spikes - Festival spikes that may boost volume.
 * @param rng - Shared RNG instance.
 * @returns Non-negative integer order count for the day.
 */
export function getDayOrderCount(
  date: string,
  baseMean: number,
  params: ResolvedParams,
  spikes: FestivalSpike[],
  rng: RNGState,
): number {
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let adjustedMean = isWeekend
    ? Math.round(baseMean * params.weekend_multiplier)
    : baseMean;

  const festivalMultiplier = getFestivalMultiplier(date, spikes);
  adjustedMean = Math.round(adjustedMean * festivalMultiplier);

  if (adjustedMean <= 0) {
    return 0;
  }

  return nextInt(
    rng,
    Math.max(1, Math.round(adjustedMean * 0.85)),
    Math.round(adjustedMean * 1.15),
  );
}

/** Converts seconds since midnight into hour, minute, and second components. */
function secondsToHMS(totalSeconds: number): {
  hour: number;
  minute: number;
  second: number;
} {
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;
  return { hour, minute, second };
}

/**
 * Picks a random time within `[startHour:00, endHour:00)` expressed as seconds.
 * `endHour` is exclusive — e.g. 18–23 yields up to 22:59:59.
 */
function randomTimeInWindow(
  rng: RNGState,
  startHour: number,
  endHour: number,
): { hour: number; minute: number; second: number } {
  const startSeconds = startHour * 3600;
  const endSeconds = endHour * 3600 - 1;
  const picked = nextInt(rng, startSeconds, endSeconds);
  return secondsToHMS(picked);
}

/** Formats a local IST timestamp with fixed `+05:30` offset. */
function formatISTTimestamp(
  date: string,
  hour: number,
  minute: number,
  second: number,
): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return `${date}T${hh}:${mm}:${ss}${IST_OFFSET}`;
}

/** Parses an IST timestamp back to epoch ms for sorting. */
function parseISTTimestamp(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Generates sorted ISO 8601 order timestamps for a single day.
 * Splits orders between a daytime window (08:00–18:00) and an evening
 * window (18:00–23:00) according to `evening_concentration`.
 *
 * @param date - ISO date string for the day.
 * @param count - Number of timestamps to produce.
 * @param params - Resolved segment parameters (evening concentration).
 * @param rng - Shared RNG instance.
 * @returns Ascending list of IST timestamps, e.g. `"2025-10-20T19:34:22+05:30"`.
 */
export function generateDayTimestamps(
  date: string,
  count: number,
  params: ResolvedParams,
  rng: RNGState,
): string[] {
  if (count <= 0) {
    return [];
  }

  // evening_concentration = fraction of orders placed 18:00–23:00.
  const eveningCount = Math.round(count * params.evening_concentration);
  const dayCount = count - eveningCount;

  const timestamps: string[] = [];

  for (let i = 0; i < dayCount; i++) {
    const { hour, minute, second } = randomTimeInWindow(rng, 8, 18);
    timestamps.push(formatISTTimestamp(date, hour, minute, second));
  }

  for (let i = 0; i < eveningCount; i++) {
    const { hour, minute, second } = randomTimeInWindow(rng, 18, 23);
    timestamps.push(formatISTTimestamp(date, hour, minute, second));
  }

  timestamps.sort((a, b) => parseISTTimestamp(a) - parseISTTimestamp(b));
  return timestamps;
}
