"use client";

import { useCallback, useMemo, useState } from "react";
import { CatalogUpload } from "../components/CatalogUpload";
import { GenerateButton } from "../components/GenerateButton";
import { GlobalPeriodForm } from "../components/GlobalPeriodForm";
import { PasteArea, PASTE_HEADER } from "../components/PasteArea";
import { ScenarioPicker } from "../components/ScenarioPicker";
import { TimelinePreview } from "../components/TimelinePreview";
import type { CatalogProduct } from "../lib/core/generate";
import { PROFILES } from "../lib/core/profiles/index";
import type { GeneratorOutput } from "../lib/core/schema";
import type { ParseResult } from "../lib/parser/index";
import type { GlobalPeriod, SegmentParams } from "../lib/core/segments";

/** Pasteable param columns (matches {@link PASTE_HEADER} after dates). */
const PASTE_PARAM_KEYS: (keyof SegmentParams)[] = [
  "orders_per_day_mean",
  "orders_per_day_std",
  "new_customer_rate",
  "repeat_purchase_probability",
  "cod_rate",
  "cod_rto_rate",
  "prepaid_refund_rate",
  "discount_rate",
  "discount_amount_mean",
  "aov_mean",
  "aov_std",
  "weekend_multiplier",
  "evening_concentration",
];

/** Advances an ISO date string by `days` (UTC-safe). */
function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive day count between two ISO dates. */
function daysInclusive(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

/** Formats one segment data row (no header, no global row). */
function formatSegmentRow(
  start: string,
  end: string,
  params: SegmentParams,
): string {
  const cells = [
    start,
    end,
    ...PASTE_PARAM_KEYS.map((key) => {
      const value = params[key];
      return value === undefined ? "" : String(value);
    }),
  ];
  return cells.join(", ");
}

/** Global row for pasted CSV. */
function formatGlobalRow(global: GlobalPeriod): string {
  return `global,global,period_start=${global.period_start},period_end=${global.period_end},seed=${global.seed}`;
}

/** Builds default paste text when a scenario is selected. */
function buildScenarioPreset(
  scenarioId: string,
  global: GlobalPeriod,
): string {
  const profile = PROFILES[scenarioId];
  if (!profile) {
    return "";
  }

  const base = profile.params;
  const lines = [PASTE_HEADER, formatGlobalRow(global)];

  const pickParams = (overrides: SegmentParams): SegmentParams => ({
    orders_per_day_mean: overrides.orders_per_day_mean ?? base.orders_per_day_mean,
    orders_per_day_std: overrides.orders_per_day_std ?? base.orders_per_day_std,
    new_customer_rate: overrides.new_customer_rate ?? base.new_customer_rate,
    repeat_purchase_probability:
      overrides.repeat_purchase_probability ?? base.repeat_purchase_probability,
    cod_rate: overrides.cod_rate ?? base.cod_rate,
    cod_rto_rate: overrides.cod_rto_rate ?? base.cod_rto_rate,
    prepaid_refund_rate:
      overrides.prepaid_refund_rate ?? base.prepaid_refund_rate,
    discount_rate: overrides.discount_rate ?? base.discount_rate,
    discount_amount_mean:
      overrides.discount_amount_mean ?? base.discount_amount_mean,
    aov_mean: overrides.aov_mean ?? base.aov_mean,
    aov_std: overrides.aov_std ?? base.aov_std,
    weekend_multiplier:
      overrides.weekend_multiplier ?? base.weekend_multiplier,
    evening_concentration:
      overrides.evening_concentration ?? base.evening_concentration,
  });

  if (scenarioId === "edgecraft") {
    const totalDays = daysInclusive(global.period_start, global.period_end);
    const firstHalfDays = Math.floor(totalDays / 2);
    const firstEnd = addDays(global.period_start, firstHalfDays - 1);
    const secondStart = addDays(firstEnd, 1);

    lines.push(
      formatSegmentRow(global.period_start, firstEnd, pickParams({})),
      formatSegmentRow(
        secondStart,
        global.period_end,
        pickParams({
          orders_per_day_mean: 28,
          discount_rate: 0.32,
          prepaid_refund_rate: 0.14,
          new_customer_rate: 0.48,
          repeat_purchase_probability: 0.12,
        }),
      ),
    );
    return lines.join("\n");
  }

  if (scenarioId === "glowlab") {
    const rampDays = base.trend.ramp_days ?? 120;
    const rampEnd = addDays(global.period_start, rampDays - 1);
    const plateauStart = addDays(rampEnd, 1);

    lines.push(
      formatSegmentRow(
        global.period_start,
        rampEnd,
        pickParams({ orders_per_day_mean: 18 }),
      ),
      formatSegmentRow(plateauStart, global.period_end, pickParams({})),
    );
    return lines.join("\n");
  }

  lines.push(
    formatSegmentRow(global.period_start, global.period_end, pickParams({})),
  );
  return lines.join("\n");
}

export default function Home() {
  const [globalPeriod, setGlobalPeriod] = useState<GlobalPeriod>({
    period_start: "2025-06-01",
    period_end: "2026-02-28",
    seed: 42,
  });
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [, setGeneratorOutput] = useState<GeneratorOutput | null>(null);
  const [uploadedCatalog, setUploadedCatalog] = useState<
    CatalogProduct[] | null
  >(null);

  const handleParsed = useCallback((result: ParseResult) => {
    setParseResult(result);
  }, []);

  const handleGenerateComplete = useCallback((output: GeneratorOutput) => {
    setGeneratorOutput(output);
  }, []);

  const handleCatalogParsed = useCallback(
    (catalog: CatalogProduct[] | null, _warnings: string[]) => {
      setUploadedCatalog(catalog);
    },
    [],
  );

  const presetRaw = useMemo(() => {
    if (!selectedScenario) {
      return undefined;
    }
    return buildScenarioPreset(selectedScenario, globalPeriod);
  }, [selectedScenario, globalPeriod]);

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

          <ScenarioPicker
            selectedId={selectedScenario}
            onSelectId={setSelectedScenario}
            onQuickFill={() => {
              /* BaseParamsForm wiring is a follow-up step */
            }}
          />

          <CatalogUpload onCatalogParsed={handleCatalogParsed} />

          <PasteArea
            globalPeriod={globalPeriod}
            onParsed={handleParsed}
            presetRaw={presetRaw}
          />

          {parseResult && (
            <TimelinePreview
              parseResult={parseResult}
              selectedScenario={selectedScenario}
            />
          )}

          <GenerateButton
            parseResult={parseResult}
            selectedScenario={selectedScenario}
            globalPeriod={globalPeriod}
            uploadedCatalog={uploadedCatalog}
            onComplete={handleGenerateComplete}
          />
        </div>
      </main>
    </div>
  );
}
