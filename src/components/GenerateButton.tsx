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
  onComplete: (output: GeneratorOutput) => void;
}

/** Triggers JSON download of the generated dataset. */
function downloadOutput(output: GeneratorOutput, label: string): void {
  const blob = new Blob([JSON.stringify(output, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${label}-${output.period_start}-${output.period_end}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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

  if (options.parseResult === null) {
    parts.push("Paste a segment timeline");
  } else if (options.parseResult.errors.length > 0) {
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

  const isDisabled =
    loading ||
    parseResult === null ||
    parseResult.errors.length > 0 ||
    !hasCatalog ||
    !paramsValid;

  const handleGenerate = () => {
    if (isDisabled || !parseResult || !catalog || !baseParams) {
      return;
    }

    const storeId = catalog[0]?.store_id ?? "custom-store";
    const global = parseResult.global ?? globalPeriod;

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
        segments: parseResult.segments,
        spikes: INDIA_FESTIVAL_SPIKES,
        catalog,
        collections: [],
      });

      setLoading(false);
      setSummary(
        `Generated ${output.orders.length.toLocaleString()} orders, ${output.customers.length.toLocaleString()} customers, ${output.products.length.toLocaleString()} products`,
      );
      onComplete(output);
      downloadOutput(output, downloadLabel ?? storeId);
    }, 0);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Generate</h2>

      <button
        type="button"
        disabled={isDisabled}
        onClick={handleGenerate}
        className="rounded-md bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        {loading ? "Generating..." : "Generate dataset"}
      </button>

      {isDisabled && !loading && (
        <p className="text-sm text-zinc-500">
          {buildDisabledHelper({
            hasCatalog,
            baseParams,
            paramErrorCount: paramErrors.length,
            parseResult,
          })}
        </p>
      )}

      {summary && (
        <p className="text-sm font-medium text-green-700" role="status">
          {summary}
        </p>
      )}
    </section>
  );
}
