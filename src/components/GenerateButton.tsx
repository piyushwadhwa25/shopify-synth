"use client";

import { useState } from "react";
import { generate } from "../lib/core/generate";
import type { CatalogProduct } from "../lib/core/generate";
import type { FestivalSpike } from "../lib/core/timestamps";
import type { ParseResult } from "../lib/parser/index";
import type { GlobalPeriod, SegmentParams } from "../lib/core/segments";
import type { GeneratorOutput } from "../lib/core/schema";
import { validateBaseParams } from "../lib/core/validate-base-params";

/** Standard India festival spikes applied to every generation run. */
const INDIA_FESTIVAL_SPIKES: FestivalSpike[] = [
  {
    label: "Diwali 2025",
    start_date: "2025-10-15",
    end_date: "2025-11-05",
    multiplier: 3.5,
  },
  {
    label: "Valentine's 2026",
    start_date: "2026-02-10",
    end_date: "2026-02-14",
    multiplier: 2.0,
  },
  {
    label: "Holi 2026",
    start_date: "2026-03-12",
    end_date: "2026-03-15",
    multiplier: 1.8,
  },
  {
    label: "New Year 2026",
    start_date: "2025-12-28",
    end_date: "2026-01-02",
    multiplier: 2.5,
  },
];

/** Props for {@link GenerateButton}. */
export interface GenerateButtonProps {
  parseResult: ParseResult | null;
  globalPeriod: GlobalPeriod;
  /** Required product catalog from CSV upload. */
  catalog: CatalogProduct[] | null;
  /** Base generation params from the form / quick-fill. */
  baseParams: Required<SegmentParams> | null;
  /** Optional label used in the downloaded filename. */
  downloadLabel?: string | null;
  /** Fires with the full output and the exact params used for that run. */
  onComplete: (
    output: GeneratorOutput,
    usedParams: Required<SegmentParams>,
  ) => void;
}

/** Builds disabled-state helper copy from whatever is still missing. */
function buildDisabledHelper(options: {
  hasCatalog: boolean;
  baseParams: Required<SegmentParams> | null;
  paramErrorCount: number;
  parseResult: ParseResult | null;
}): string {
  const parts: string[] = [];

  if (!options.hasCatalog) {
    parts.push("Upload a product catalog");
  }

  if (options.baseParams === null) {
    parts.push("Fill in all parameters");
  } else if (options.paramErrorCount > 0) {
    parts.push(`Fix ${options.paramErrorCount} parameter errors`);
  }

  if (options.parseResult !== null && options.parseResult.errors.length > 0) {
    parts.push("Fix paste errors");
  }

  return parts.join(". ") + (parts.length > 0 ? "." : "");
}

/**
 * Runs the synthetic data generator when catalog, base params, and paste
 * validation are all satisfied.
 */
export function GenerateButton({
  parseResult,
  globalPeriod,
  catalog,
  baseParams,
  downloadLabel = null,
  onComplete,
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const hasCatalog = catalog !== null && catalog.length > 0;
  const paramErrors =
    baseParams === null ? [] : validateBaseParams(baseParams);
  const paramsValid = baseParams !== null && paramErrors.length === 0;

  const hasPasteErrors =
    parseResult !== null && parseResult.errors.length > 0;

  const isDisabled =
    loading || !hasCatalog || !paramsValid || hasPasteErrors;

  const handleGenerate = () => {
    if (isDisabled || !catalog || !baseParams) {
      return;
    }

    const storeId = catalog[0]?.store_id ?? "custom-store";
    const global = parseResult?.global ?? globalPeriod;
    const segments = parseResult?.segments ?? [];

    setLoading(true);
    setSummary(null);

    window.setTimeout(() => {
      const output = generate({
        global,
        base: {
          scenario: downloadLabel ?? storeId,
          store_id: storeId,
          params: baseParams,
        },
        segments,
        spikes: INDIA_FESTIVAL_SPIKES,
        catalog,
        collections: [],
      });

      setLoading(false);
      setSummary(
        `Generated ${output.orders.length.toLocaleString()} orders, ${output.customers.length.toLocaleString()} customers, ${output.products.length.toLocaleString()} products`,
      );
      onComplete(output, baseParams);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleGenerate}
        className="rounded-sm bg-signal px-5 py-2.5 font-sans font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Generating..." : "Generate dataset"}
      </button>

      {isDisabled && !loading && (
        <p className="font-sans text-xs text-ink-muted">
          {buildDisabledHelper({
            hasCatalog,
            baseParams,
            paramErrorCount: paramErrors.length,
            parseResult,
          })}
        </p>
      )}

      {summary && (
        <p className="font-sans text-sm font-medium text-success" role="status">
          {summary}
        </p>
      )}
    </div>
  );
}
