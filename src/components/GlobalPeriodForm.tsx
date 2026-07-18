"use client";

import { InfoTooltip } from "./InfoTooltip";
import type { GlobalPeriod } from "../lib/core/segments";

/** Props for {@link GlobalPeriodForm}. */
export interface GlobalPeriodFormProps {
  value: GlobalPeriod;
  onChange: (updated: GlobalPeriod) => void;
}

/**
 * Controlled inputs for the generation window and RNG seed.
 * Validates that the end date is strictly after the start date.
 */
export function GlobalPeriodForm({ value, onChange }: GlobalPeriodFormProps) {
  const dateRangeInvalid =
    value.period_start.length > 0 &&
    value.period_end.length > 0 &&
    value.period_end <= value.period_start;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col">
          <label
            htmlFor="period-start"
            className="mb-1.5 font-sans text-sm font-medium text-ink"
          >
            Start date
          </label>
          <input
            id="period-start"
            type="date"
            value={value.period_start}
            onChange={(e) =>
              onChange({ ...value, period_start: e.target.value })
            }
            className="rounded-sm border border-line bg-white px-3 py-2 font-mono text-sm transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>

        <div className="flex flex-col">
          <label
            htmlFor="period-end"
            className="mb-1.5 font-sans text-sm font-medium text-ink"
          >
            End date
          </label>
          <input
            id="period-end"
            type="date"
            value={value.period_end}
            onChange={(e) =>
              onChange({ ...value, period_end: e.target.value })
            }
            className="rounded-sm border border-line bg-white px-3 py-2 font-mono text-sm transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
            aria-invalid={dateRangeInvalid}
          />
          {dateRangeInvalid && (
            <span className="mt-1 font-sans text-xs text-danger" role="alert">
              End date must be after start date
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <div className="mb-1.5 flex items-center gap-1">
            <label
              htmlFor="rng-seed"
              className="font-sans text-sm font-medium text-ink"
            >
              RNG Seed
            </label>
            <InfoTooltip description="Starting number for the random generator. The same seed with the same parameters always produces identical output. Change the seed to get a different random variation of the same behavior." />
          </div>
          <input
            id="rng-seed"
            type="number"
            step={1}
            value={value.seed}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              onChange({
                ...value,
                seed: Number.isNaN(parsed) ? 0 : parsed,
              });
            }}
            className="rounded-sm border border-line bg-white px-3 py-2 font-mono text-sm transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </div>
      </div>

      <p className="font-sans text-xs text-ink-muted">
        Same seed + same params = identical output every run
      </p>
    </div>
  );
}
