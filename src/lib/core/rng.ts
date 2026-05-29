/** Mutable 32-bit seed state for the mulberry32 PRNG. */
export type RNGState = { seed: number };

/**
 * Creates a new RNG instance from a numeric seed.
 * Coerce the seed to an unsigned 32-bit integer so runs are reproducible across platforms.
 *
 * @param seed - Initial seed; the same value always yields the same sequence.
 * @returns A fresh RNG state. Create one per generator run and pass it through.
 */
export function createRNG(seed: number): RNGState {
  return { seed: seed >>> 0 };
}

/**
 * Returns a pseudo-random float in `[0, 1)`.
 * Core primitive: all other helpers derive randomness from this call.
 * Mutates `rng.seed` on each invocation (mulberry32).
 *
 * @param rng - RNG state to advance.
 */
export function next(rng: RNGState): number {
  let t = (rng.seed += 0x6d2b79f5);
  // Scramble bits: xor-shift and multiply to spread entropy across the word.
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  // Convert to unsigned 32-bit integer, then scale to [0, 1).
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Returns a float in `[min, max)` — inclusive of `min`, exclusive of `max`.
 *
 * @param rng - RNG state.
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (exclusive). Must be greater than `min`.
 */
export function nextFloat(rng: RNGState, min: number, max: number): number {
  return min + next(rng) * (max - min);
}

/**
 * Returns an integer in `[min, max]` (both bounds inclusive).
 *
 * @param rng - RNG state.
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (inclusive). Must be `>= min`.
 */
export function nextInt(rng: RNGState, min: number, max: number): number {
  return Math.floor(nextFloat(rng, min, max + 1));
}

/**
 * Returns `true` with the given probability.
 *
 * @param rng - RNG state.
 * @param probability - Chance of `true`, in `[0, 1]`. Values outside that range
 *   always yield `false` or `true` respectively.
 */
export function nextBool(rng: RNGState, probability: number): boolean {
  return next(rng) < probability;
}

/**
 * Picks one element from an array with uniform probability.
 *
 * @param rng - RNG state.
 * @param arr - Non-empty array to choose from.
 * @throws If `arr` is empty.
 */
export function pickOne<T>(rng: RNGState, arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("pickOne: cannot pick from an empty array");
  }
  return arr[nextInt(rng, 0, arr.length - 1)];
}

/**
 * Picks one element using normalized weights (weights need not sum to 1).
 *
 * @param rng - RNG state.
 * @param items - Choices; must be the same length as `weights`.
 * @param weights - Non-negative weights; at least one must be positive.
 * @throws If lengths differ, arrays are empty, or all weights are zero.
 */
export function pickWeighted<T>(
  rng: RNGState,
  items: T[],
  weights: number[],
): T {
  if (items.length === 0) {
    throw new Error("pickWeighted: items array is empty");
  }
  if (items.length !== weights.length) {
    throw new Error("pickWeighted: items and weights must have the same length");
  }

  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total === 0) {
    throw new Error("pickWeighted: all weights are zero or negative");
  }

  let threshold = next(rng) * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= Math.max(0, weights[i]);
    if (threshold < 0) {
      return items[i];
    }
  }

  // Floating-point residue: return the last item with positive weight.
  for (let i = items.length - 1; i >= 0; i--) {
    if (weights[i] > 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Samples from a normal (Gaussian) distribution via the Box-Muller transform.
 * Optionally clamps the result to `[min, max]` when those bounds are provided.
 *
 * @param rng - RNG state (consumes two uniform draws internally).
 * @param mean - Distribution mean.
 * @param std - Standard deviation; must be non-negative.
 * @param min - Optional lower clamp (inclusive).
 * @param max - Optional upper clamp (inclusive).
 */
export function nextNormal(
  rng: RNGState,
  mean: number,
  std: number,
  min?: number,
  max?: number,
): number {
  // Box-Muller: two independent uniforms -> one standard normal sample.
  const u1 = Math.max(next(rng), Number.EPSILON);
  const u2 = next(rng);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let value = mean + std * z;

  if (min !== undefined) {
    value = Math.max(min, value);
  }
  if (max !== undefined) {
    value = Math.min(max, value);
  }

  return value;
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * Returns the same array reference (mutated).
 *
 * @param rng - RNG state.
 * @param arr - Array to shuffle; empty arrays are returned unchanged.
 */
export function shuffle<T>(rng: RNGState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
