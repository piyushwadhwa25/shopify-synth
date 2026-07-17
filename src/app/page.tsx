"use client";

import { useCallback, useState } from "react";
import { BaseParamsForm } from "../components/BaseParamsForm";
import { CatalogUpload } from "../components/CatalogUpload";
import { ComparisonTable } from "../components/ComparisonTable";
import { GenerateButton } from "../components/GenerateButton";
import { GlobalPeriodForm } from "../components/GlobalPeriodForm";
import { PasteArea } from "../components/PasteArea";
import { ScenarioPicker } from "../components/ScenarioPicker";
import { TimelinePreview } from "../components/TimelinePreview";
import { compareParams } from "../lib/core/compareParams";
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
  const [lastOutput, setLastOutput] = useState<GeneratorOutput | null>(null);
  const [lastInputParams, setLastInputParams] = useState<
    Required<SegmentParams> | null
  >(null);

  const handleParsed = useCallback((result: ParseResult) => {
    setParseResult(result);
  }, []);

  const handleGenerateComplete = useCallback(
    (output: GeneratorOutput, usedParams: Required<SegmentParams>) => {
      setLastOutput(output);
      setLastInputParams(usedParams);
    },
    [],
  );

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
    <div className="min-h-full bg-paper text-ink font-sans">
      <main className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <h1 className="mb-2 font-display text-4xl text-ink">shopify-synth</h1>
        <p className="mb-16 font-sans text-ink-muted">
          Generate realistic Shopify store data for testing and evaluation.
        </p>

        <section>
          <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
            01 — GENERATION PERIOD
          </div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
            Generation period
          </h2>
          <GlobalPeriodForm
            value={globalPeriod}
            onChange={setGlobalPeriod}
          />
        </section>

        <hr className="my-12 border-line" />

        <section>
          <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
            02 — PRODUCT CATALOG
          </div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
            Product catalog
          </h2>
          <CatalogUpload onCatalogParsed={handleCatalogParsed} />
        </section>

        <hr className="my-12 border-line" />

        <section>
          <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
            03 — PARAMETERS
          </div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
            Parameters
          </h2>
          <div className="space-y-8">
            <ScenarioPicker
              selectedId={selectedPresetId}
              onSelectId={setSelectedPresetId}
              onQuickFill={handleQuickFill}
            />
            <BaseParamsForm
              value={baseParams ?? EMPTY_BASE_PARAMS}
              onChange={setBaseParams}
            />
          </div>
        </section>

        <hr className="my-12 border-line" />

        <section>
          <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
            04 — TIMELINE OVERRIDES
          </div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
            Timeline overrides
          </h2>
          <PasteArea
            globalPeriod={globalPeriod}
            onParsed={handleParsed}
          />
          {parseResult && (
            <div className="mt-8">
              <TimelinePreview
                parseResult={parseResult}
                baseParams={baseParams}
              />
            </div>
          )}
        </section>

        <hr className="my-12 border-line" />

        <section>
          <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
            05 — GENERATE
          </div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
            Generate
          </h2>
          <GenerateButton
            parseResult={parseResult}
            globalPeriod={globalPeriod}
            catalog={catalog}
            baseParams={baseParams}
            downloadLabel={selectedPresetId}
            onComplete={handleGenerateComplete}
          />
        </section>

        {lastOutput && lastInputParams && (
          <>
            <hr className="my-12 border-line" />
            <section>
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                06 — RESULTS
              </div>
              <h2 className="mb-4 font-sans text-lg font-semibold text-ink">
                Results
              </h2>
              <ComparisonTable
                rows={compareParams(lastOutput, lastInputParams)}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
