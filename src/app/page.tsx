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
import { toOrderExportCsv } from "../lib/export/orderExportCsv";
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
        <header className="mb-8 flex items-center justify-between py-6">
          <span className="font-mono text-xs tracking-widest text-ink-muted">
            SHOPIFY SYNTH
          </span>
          <a
            href="https://github.com/piyushwadhwa25/shopify-synth"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm text-ink-muted transition-colors hover:text-signal"
          >
            GitHub ↗
          </a>
        </header>

        <h1 className="mb-4 font-display text-4xl">Shopify Synth</h1>
        <p className="mb-10 max-w-xl font-sans leading-relaxed text-ink-muted">
          Generates realistic, seed-reproducible Shopify store data — orders,
          customers, and catalog activity — calibrated to real D2C behavior:
          COD-heavy payment splits, return-to-origin risk, discount-driven
          demand, and festival seasonality. Built for testing pipelines and
          dashboards against data that behaves like a real store, not random
          noise.
        </p>

        <div className="mb-16 rounded-lg border border-line bg-white p-5">
          <div className="mb-3 font-mono text-xs tracking-widest text-ink-muted">
            SAMPLE OUTPUT — ONE GENERATED ORDER
          </div>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-ink">
{`{
  "order_number": 4821,
  "gateway": "cash_on_delivery",
  "financial_status": "pending",
  "total_price": "742.00",
  "line_items": [
    {
      "title": "Hot Water Bottle with Soft Cover",
      "variant_title": "Grey",
      "sku": "BLM-032-03",
      "quantity": 1,
      "price": "742.00"
    }
  ],
  "shipping_address": {
    "city": "Ahmedabad",
    "province": "Gujarat"
  }
}`}
          </pre>
          <p className="mt-3 font-sans text-xs text-ink-muted">
            One order from a generated dataset. Full output includes orders,
            customers, and catalog records — configure below to generate your
            own.
          </p>
        </div>

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
              <button
                type="button"
                onClick={() => {
                  const csv = toOrderExportCsv(lastOutput);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${lastOutput.store_id}-orders-export.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="font-sans text-sm text-signal underline hover:text-ink"
              >
                Download as Shopify export CSV
              </button>
              <ComparisonTable
                rows={compareParams(lastOutput, lastInputParams)}
              />
            </section>
          </>
        )}

        <footer className="mt-24 flex items-center justify-between border-t border-line pt-8 font-sans text-xs text-ink-muted">
          <span>MIT licensed</span>
          <a
            href="https://github.com/piyushwadhwa25/shopify-synth"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-signal"
          >
            View source on GitHub ↗
          </a>
        </footer>
      </main>
    </div>
  );
}
