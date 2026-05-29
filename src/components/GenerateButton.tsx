"use client";

import { useState } from "react";
import { generate } from "../lib/core/generate";
import type { FestivalSpike } from "../lib/core/timestamps";
import { getScenarioCatalog } from "../lib/core/catalogs";
import { PROFILES } from "../lib/core/profiles/index";
import type { ParseResult } from "../lib/parser/index";
import type { GlobalPeriod } from "../lib/core/segments";
import type { GeneratorOutput } from "../lib/core/schema";

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
  selectedScenario: string | null;
  globalPeriod: GlobalPeriod;
  onComplete: (output: GeneratorOutput) => void;
}

/** Triggers JSON download of the generated dataset. */
function downloadOutput(
  output: GeneratorOutput,
  scenarioId: string,
): void {
  const blob = new Blob([JSON.stringify(output, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${scenarioId}-${output.period_start}-${output.period_end}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Runs the synthetic data generator when the paste is valid and a scenario
 * is selected; shows loading state, summary stats, and triggers JSON download.
 */
export function GenerateButton({
  parseResult,
  selectedScenario,
  globalPeriod,
  onComplete,
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const isDisabled =
    loading ||
    parseResult === null ||
    parseResult.errors.length > 0 ||
    selectedScenario === null ||
    !PROFILES[selectedScenario ?? ""];

  const handleGenerate = () => {
    if (isDisabled || !parseResult || !selectedScenario) {
      return;
    }

    const base = PROFILES[selectedScenario];
    const { catalog, collections } = getScenarioCatalog(selectedScenario);
    const global = parseResult.global ?? globalPeriod;

    setLoading(true);
    setSummary(null);

    window.setTimeout(() => {
      const output = generate({
        global,
        base,
        segments: parseResult.segments,
        spikes: INDIA_FESTIVAL_SPIKES,
        catalog,
        collections,
      });

      setLoading(false);
      setSummary(
        `Generated ${output.orders.length.toLocaleString()} orders, ${output.customers.length.toLocaleString()} customers, ${output.products.length.toLocaleString()} products`,
      );
      onComplete(output);
      downloadOutput(output, selectedScenario);
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
          Select a scenario and fix paste errors before generating.
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
