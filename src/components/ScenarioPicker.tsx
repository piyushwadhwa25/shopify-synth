"use client";

import { useState } from "react";
import { PROFILES } from "../lib/core/profiles/index";

/** Props for {@link ScenarioPicker}. */
export interface ScenarioPickerProps {
  onSelect: (scenarioId: string) => void;
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

/** Display order for scenario cards. */
const SCENARIO_ORDER = [
  "bloom",
  "threadrush",
  "fanvault",
  "glowlab",
  "edgecraft",
  "slumberco",
] as const;

/**
 * Grid of scenario profile cards. Clicking a card selects it and
 * notifies the parent via `onSelect`.
 */
export function ScenarioPicker({ onSelect }: ScenarioPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Scenario</h2>

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
                setSelectedId(scenarioId);
                onSelect(scenarioId);
              }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
                  : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
              }`}
            >
              <span className="block font-semibold text-zinc-900">
                {profile.scenario}
              </span>
              <span className="mt-1 block text-sm text-zinc-600">
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
