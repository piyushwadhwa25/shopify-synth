"use client";

import type { SegmentParams } from "../lib/core/segments";
import { PROFILES } from "../lib/core/profiles/index";

/** Props for {@link ScenarioPicker}. */
export interface ScenarioPickerProps {
  /** Applies a preset's params into the base-params form. */
  onQuickFill: (params: Required<SegmentParams>) => void;
  /** Highlight state only — which preset was last applied. */
  selectedId: string | null;
  /** Updates highlight after a card click. */
  onSelectId: (id: string) => void;
}

/** One-line archetype copy keyed by profile slug. */
const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  bloom: "Subscription wellness — high retention, low COD",
  threadrush: "Discount-dependent fashion — high volume, weekend spikes",
  fanvault: "COD-heavy licensed catalog — high RTO risk",
  glowlab: "Hero product + launch ramp — mostly new customers",
  edgecraft: "Declining brand — rising discounts, rising refunds",
  slumberco: "High AOV, low frequency — metro prepaid, festival peaks",
};

/** Display order for quick-fill cards. */
const SCENARIO_ORDER = [
  "bloom",
  "threadrush",
  "fanvault",
  "glowlab",
  "edgecraft",
  "slumberco",
] as const;

/**
 * Optional quick-fill cards that load profile params into BaseParamsForm.
 * Scenario names are not shown — only the one-line description.
 */
export function ScenarioPicker({
  onQuickFill,
  selectedId,
  onSelectId,
}: ScenarioPickerProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Quick-fill (optional)
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Click a preset to fill the fields below. You can still edit any value
          after.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIO_ORDER.map((scenarioId) => {
          const profile = PROFILES[scenarioId];
          const isSelected = selectedId === scenarioId;
          const description = ARCHETYPE_DESCRIPTIONS[scenarioId] ?? "";

          return (
            <button
              key={scenarioId}
              type="button"
              onClick={() => {
                onQuickFill(profile.params);
                onSelectId(scenarioId);
              }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
                  : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
              }`}
            >
              <span className="block text-sm font-semibold text-zinc-900">
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
