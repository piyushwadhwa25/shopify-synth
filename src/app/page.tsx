"use client";

import { useCallback, useRef, useState } from "react";
import { AovPreview } from "../components/AovPreview";
import { BaseParamsForm } from "../components/BaseParamsForm";
import { CatalogUpload } from "../components/CatalogUpload";
import { ComparisonTable } from "../components/ComparisonTable";
import { GenerateButton } from "../components/GenerateButton";
import { GlobalPeriodForm } from "../components/GlobalPeriodForm";
import { PasteArea } from "../components/PasteArea";
import { ScenarioPicker } from "../components/ScenarioPicker";
import { SectionNav } from "../components/SectionNav";
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
  items_per_order_mean: 1.5,
  multi_unit_rate: 0.2,
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
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleParsed = useCallback((result: ParseResult) => {
    setParseResult(result);
  }, []);

  const handleGenerateComplete = useCallback(
    (output: GeneratorOutput, usedParams: Required<SegmentParams>) => {
      setLastOutput(output);
      setLastInputParams(usedParams);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
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
    <div className="min-h-full bg-paper font-sans text-ink">
      <main className="mx-auto max-w-7xl px-6 py-16 md:py-24 lg:px-10">
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-16">
          <nav className="sticky top-12 hidden self-start lg:block">
            <SectionNav />
          </nav>

          <div className="max-w-4xl">
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

            <h1 className="font-display text-5xl md:text-6xl">
              Shopify Synth
            </h1>
            <svg
              width="120"
              height="12"
              viewBox="0 0 120 12"
              className="mb-6"
              fill="none"
            >
              <path
                d="M2 8 Q 20 2, 40 7 T 80 6 T 118 5"
                stroke="var(--signal)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
              />
            </svg>
            <p className="mb-10 max-w-xl font-sans leading-relaxed text-ink-muted">
              Generates realistic, seed-reproducible Shopify store data: orders,
              customers, and catalog records. Calibrated to real D2C behavior,
              including COD-heavy payment splits, return-to-origin risk,
              discount-driven demand, and festival seasonality. Built to test
              pipelines and dashboards against data that behaves like a real store.
            </p>

            <div className="mb-16 grid grid-cols-1 gap-6 rounded-lg border border-line bg-white p-6 sm:grid-cols-4">
              {[
                {
                  n: "1",
                  title: "Upload a catalog",
                  body: "Bring your own product export CSV, or use the sample.",
                },
                {
                  n: "2",
                  title: "Set parameters",
                  body: "Click a preset to quick-fill, or dial in your own values.",
                },
                {
                  n: "3",
                  title: "Add overrides",
                  body: "Optional. Layer in festival spikes or campaign windows, or skip this step entirely.",
                },
                {
                  n: "4",
                  title: "Generate",
                  body: "Download as JSON or a Shopify-shaped order export CSV.",
                },
              ].map((step) => (
                <div key={step.n}>
                  <div className="mb-2 font-mono text-xs text-signal">
                    {step.n}
                  </div>
                  <div className="mb-1 font-sans text-sm font-semibold">
                    {step.title}
                  </div>
                  <p className="font-sans text-xs leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            <section id="period" className="scroll-mt-12">
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                01 / GENERATION PERIOD
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
                Generation period
              </h2>
              <GlobalPeriodForm
                value={globalPeriod}
                onChange={setGlobalPeriod}
              />
            </section>

            <hr className="my-12 border-line" />

            <section id="catalog" className="scroll-mt-12">
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                02 / PRODUCT CATALOG
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
                Product catalog
              </h2>
              <CatalogUpload onCatalogParsed={handleCatalogParsed} />
            </section>

            <hr className="my-12 border-line" />

            <section id="parameters" className="scroll-mt-12">
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                03 / PARAMETERS
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
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
                <AovPreview
                  catalog={catalog}
                  itemsPerOrderMean={
                    (baseParams ?? EMPTY_BASE_PARAMS).items_per_order_mean
                  }
                  multiUnitRate={
                    (baseParams ?? EMPTY_BASE_PARAMS).multi_unit_rate
                  }
                />
              </div>
            </section>

            <hr className="my-12 border-line" />

            <section id="overrides" className="scroll-mt-12">
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                04 / TIMELINE OVERRIDES
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
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

            <section id="generate" className="scroll-mt-12">
              <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                05 / GENERATE
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
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
              <div ref={resultsRef} id="results" className="scroll-mt-12">
                <hr className="my-12 border-line" />
                <section>
                  <div className="mb-2 font-mono text-xs tracking-widest text-ink-muted">
                    06 / RESULTS
                  </div>
                  <h2 className="font-sans font-semibold text-2xl md:text-3xl text-ink mb-4">
                    Results
                  </h2>
                  <div className="mb-6 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob(
                          [JSON.stringify(lastOutput, null, 2)],
                          { type: "application/json" },
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedPresetId ?? lastOutput.store_id}-${lastOutput.period_start}-${lastOutput.period_end}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="font-sans text-sm text-signal underline hover:text-ink"
                    >
                      Download as JSON
                    </button>
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
                  </div>
                  <details className="mt-4">
                    <summary className="w-fit cursor-pointer font-sans text-sm text-signal hover:text-ink">
                      What does a generated order look like?
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-white p-4 font-mono text-xs leading-relaxed text-ink">
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
                  </details>
                  <ComparisonTable
                    rows={compareParams(
                      lastOutput,
                      lastInputParams,
                      catalog ?? [],
                    )}
                  />
                </section>
              </div>
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
          </div>
        </div>
      </main>
    </div>
  );
}
