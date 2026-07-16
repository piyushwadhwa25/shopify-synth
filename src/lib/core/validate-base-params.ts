import type { SegmentParams } from "./segments";
import { collectParamErrors } from "./segments";

/**
 * Validates base generation parameters using the same per-field rules as
 * {@link collectParamErrors} / {@link validateSegments} (rates in [0, 1],
 * mean/std fields >= 0).
 *
 * @param params - Partial or full base params to check.
 * @returns Error strings; empty when valid.
 */
export function validateBaseParams(
  params: Partial<Required<SegmentParams>>,
): string[] {
  return collectParamErrors(params);
}
