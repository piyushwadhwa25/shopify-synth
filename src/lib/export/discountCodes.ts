/** Snap targets for synthesized percent-off discount codes. */
const PERCENT_SNAPS = [10, 15, 20, 25, 30, 40, 50] as const;

/** Deterministic code prefixes keyed by orderId % length. */
const CODE_PREFIXES = ["SAVE", "FESTIVE", "WELCOME", "FLASH"] as const;

/**
 * Synthesizes a display-only discount code for Shopify order-export CSV.
 * Does not affect order totals or discount math — export-layer only.
 *
 * @returns `null` when `discountAmount` is 0; otherwise e.g. `"FESTIVE20"`.
 */
export function synthesizeDiscountCode(
  subtotal: number,
  discountAmount: number,
  orderId: number,
): string | null {
  if (discountAmount === 0) {
    return null;
  }

  const percentOff =
    subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0;

  let snapped: (typeof PERCENT_SNAPS)[number] = PERCENT_SNAPS[0];
  let bestDist = Math.abs(percentOff - snapped);
  for (let i = 1; i < PERCENT_SNAPS.length; i++) {
    const candidate = PERCENT_SNAPS[i];
    const dist = Math.abs(percentOff - candidate);
    if (dist < bestDist) {
      snapped = candidate;
      bestDist = dist;
    }
  }

  const prefix = CODE_PREFIXES[orderId % CODE_PREFIXES.length];
  return `${prefix}${snapped}`;
}
