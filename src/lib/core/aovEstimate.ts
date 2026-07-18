import type { CatalogProduct } from "./generate";

/**
 * Estimates expected order value from catalog prices and basket
 * behavior params — AOV is derived, not a direct input.
 */
export function estimateAov(
  catalog: CatalogProduct[],
  itemsPerOrderMean: number,
  multiUnitRate: number,
): number {
  if (catalog.length === 0) {
    return 0;
  }
  const totalShare =
    catalog.reduce((sum, p) => sum + p.revenue_share, 0) || 1;
  const weightedAvgPrice = catalog.reduce(
    (sum, p) => sum + p.price_mean * (p.revenue_share / totalShare),
    0,
  );
  return weightedAvgPrice * itemsPerOrderMean * (1 + multiUnitRate);
}
