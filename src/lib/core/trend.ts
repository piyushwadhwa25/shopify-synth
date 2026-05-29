import type { RNGState } from "./rng.js";
import { nextNormal } from "./rng.js";

/** Ways a scenario parameter can evolve across the generation period. */
export type TrendMode =
  | "flat"
  | "linear"
  | "declining"
  | "launch_ramp";

/** Describes how a base parameter value should change day by day. */
export interface TrendConfig {
  mode: TrendMode;
  /** Trend magnitude: 0 = no effect, 1 = doubles (linear) or halves (declining) at period end. */
  strength: number;
  /** For `launch_ramp`: days until the value reaches its plateau; defaults to `totalDays`. */
  ramp_days?: number;
  /** Optional daily jitter (standard deviation of a normal draw); skipped when omitted or zero. */
  noise_std?: number;
}

/**
 * Computes the trend-adjusted parameter value for a given day.
 *
 * @param dayIndex - 0-based day index within the period (last day may equal `totalDays`).
 * @param totalDays - Total span of the period used as the interpolation denominator.
 * @param baseValue - Starting value from the scenario profile.
 * @param config - Trend mode and strength settings.
 * @param rng - Shared RNG; used only when `noise_std` is set.
 * @returns Interpolated value with optional noise; never negative.
 */
export function applyTrend(
  dayIndex: number,
  totalDays: number,
  baseValue: number,
  config: TrendConfig,
  rng: RNGState,
): number {
  const progress =
    totalDays > 0 ? Math.min(Math.max(dayIndex, 0), totalDays) / totalDays : 0;

  let value: number;

  switch (config.mode) {
    case "flat":
      // No drift — constant across the entire period.
      value = baseValue;
      break;

    case "linear":
      // Linear drift from baseValue to baseValue * (1 + strength).
      value = baseValue * (1 + config.strength * progress);
      break;

    case "declining":
      // Linear drift from baseValue to baseValue * (1 - strength).
      value = baseValue * (1 - config.strength * progress);
      break;

    case "launch_ramp": {
      const rampDays = config.ramp_days ?? totalDays;
      if (rampDays <= 0) {
        value = baseValue;
        break;
      }
      const clampedDay = Math.min(Math.max(dayIndex, 0), rampDays);
      // Ramp from 10% of base at day 0 to 100% at ramp_days, then plateau.
      const rampFactor = 0.1 + 0.9 * (clampedDay / rampDays);
      value = baseValue * rampFactor;
      break;
    }
  }

  if (config.noise_std !== undefined && config.noise_std > 0) {
    value += nextNormal(rng, 0, config.noise_std);
  }

  return Math.max(0, value);
}

/**
 * Applies {@link applyTrend} and rounds to the nearest integer.
 * Use for counts (orders, customers) that must be whole numbers.
 */
export function applyTrendInt(
  dayIndex: number,
  totalDays: number,
  baseValue: number,
  config: TrendConfig,
  rng: RNGState,
): number {
  return Math.round(
    applyTrend(dayIndex, totalDays, baseValue, config, rng),
  );
}

/**
 * Applies {@link applyTrend} and clamps the result to `[min, max]`.
 * Use for rates and proportions that must stay within bounds (e.g. `[0, 1]`).
 */
export function applyTrendClamped(
  dayIndex: number,
  totalDays: number,
  baseValue: number,
  config: TrendConfig,
  rng: RNGState,
  min: number,
  max: number,
): number {
  const value = applyTrend(dayIndex, totalDays, baseValue, config, rng);
  return Math.min(max, Math.max(min, value));
}
