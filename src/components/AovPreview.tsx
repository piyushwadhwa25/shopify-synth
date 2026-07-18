"use client";

import type { CatalogProduct } from "../lib/core/generate";
import { estimateAov } from "../lib/core/aovEstimate";

/** Props for {@link AovPreview}. */
export interface AovPreviewProps {
  catalog: CatalogProduct[] | null;
  itemsPerOrderMean: number;
  multiUnitRate: number;
}

/**
 * Live readout of estimated AOV derived from catalog prices and basket
 * behavior params (not a direct generation input).
 */
export function AovPreview({
  catalog,
  itemsPerOrderMean,
  multiUnitRate,
}: AovPreviewProps) {
  if (catalog === null || catalog.length === 0) {
    return null;
  }

  const estimated = estimateAov(catalog, itemsPerOrderMean, multiUnitRate);

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="mb-1 font-mono text-xs tracking-widest text-ink-muted">
        ESTIMATED AOV
      </div>
      <div className="font-mono text-2xl text-signal">
        ₹{estimated.toFixed(2)}
      </div>
      <p className="mt-1 font-sans text-xs text-ink-muted">
        Derived from your catalog&apos;s prices and the two basket params above. It
        isn&apos;t a target you set directly.
      </p>
    </div>
  );
}
