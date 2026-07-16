"use client";

import { useCallback, useState } from "react";
import { BaseParamsForm } from "../components/BaseParamsForm";
import { CatalogUpload } from "../components/CatalogUpload";
import { GenerateButton } from "../components/GenerateButton";
import { GlobalPeriodForm } from "../components/GlobalPeriodForm";
import { PasteArea } from "../components/PasteArea";
import { ScenarioPicker } from "../components/ScenarioPicker";
import { TimelinePreview } from "../components/TimelinePreview";
import type { CatalogProduct } from "../lib/core/generate";
import type { GeneratorOutput } from "../lib/core/schema";
import type { ParseResult } from "../lib/parser/index";
import type { GlobalPeriod, SegmentParams } from "../lib/core/segments";

/**
 * Zeroed controlled defaults for {@link BaseParamsForm} while `baseParams`
 * state is still null (user has not edited or quick-filled yet).
 */
const EMPTY_BASE_PARAMS: Required<SegmentParams> = {
  orders_per_day_mean: 0,
  orders_per_day_std: 0,
  new_customer_rate: 0,
  repeat_purchase_probability: 0,
  cod_rate: 0,
  cod_rto_rate: 0,
  prepaid_refund_rate: 0,
  discount_rate: 0,
  discount_amount_mean: 0,
  aov_mean: 0,
  aov_std: 0,
  weekend_multiplier: 0,
  evening_concentration: 0,
  trend: {
    mode: "flat",
    strength: 0,
  },
};

export default function Home() {
  const [globalPeriod, setGlobalPeriod] = useState<GlobalPeriod>({
    period_start: "2025-06-01",
    period_end: "2026-02-28",
    seed: 42,
  });
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [baseParams, setBaseParams] = useState<Required<SegmentParams> | null>(
    null,
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [, setGeneratorOutput] = useState<GeneratorOutput | null>(null);

  const handleParsed = useCallback((result: ParseResult) => {
    setParseResult(result);
  }, []);

  const handleGenerateComplete = useCallback((output: GeneratorOutput) => {
    setGeneratorOutput(output);
  }, []);

  const handleCatalogParsed = useCallback(
    (nextCatalog: CatalogProduct[] | null, warnings: string[]) => {
      setCatalog(nextCatalog);
      setCatalogWarnings(warnings);
    },
    [],
  );

  const handleQuickFill = useCallback((params: Required<SegmentParams>) => {
    setBaseParams(params);
  }, []);

  return (
    <div className="min-h-full bg-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-10 border-b border-zinc-200 pb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            shopify-synth
          </h1>
          <p className="mt-2 text-zinc-600">
            Generate realistic Shopify store data for testing and evaluation
          </p>
        </header>

        <div className="space-y-10">
          <GlobalPeriodForm
            value={globalPeriod}
            onChange={setGlobalPeriod}
          />

          <CatalogUpload onCatalogParsed={handleCatalogParsed} />

          <section className="space-y-8">
            <h2 className="text-lg font-semibold text-zinc-900">Parameters</h2>

            <ScenarioPicker
              selectedId={selectedPresetId}
              onSelectId={setSelectedPresetId}
              onQuickFill={handleQuickFill}
            />

            <BaseParamsForm
              value={baseParams ?? EMPTY_BASE_PARAMS}
              onChange={setBaseParams}
            />
          </section>

          <PasteArea
            globalPeriod={globalPeriod}
            onParsed={handleParsed}
          />

          {parseResult && (
            <TimelinePreview
              parseResult={parseResult}
              baseParams={baseParams}
            />
          )}

          <GenerateButton
            parseResult={parseResult}
            globalPeriod={globalPeriod}
            catalog={catalog}
            baseParams={baseParams}
            downloadLabel={selectedPresetId}
            onComplete={handleGenerateComplete}
          />
        </div>
      </main>
    </div>
  );
}
