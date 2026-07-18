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
    <div className="space-y-4">
      <div>
        <h3 className="font-sans text-sm font-semibold text-ink">
          Quick-fill (optional)
        </h3>
        <p className="mt-1 font-sans text-xs text-ink-muted">
          Click a preset to fill the fields below. You can still edit any value
          after.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              className={`cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? "border-signal bg-signal-soft"
                  : "border-line hover:border-signal"
              }`}
            >
              <span className="block font-sans text-sm font-medium text-ink">
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
