"use client";

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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Generation period</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span className="font-medium">Start date</span>
          <input
            type="date"
            value={value.period_start}
            onChange={(e) =>
              onChange({ ...value, period_start: e.target.value })
            }
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span className="font-medium">End date</span>
          <input
            type="date"
            value={value.period_end}
            onChange={(e) =>
              onChange({ ...value, period_end: e.target.value })
            }
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            aria-invalid={dateRangeInvalid}
          />
          {dateRangeInvalid && (
            <span className="text-sm text-red-600" role="alert">
              End date must be after start date
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span className="font-medium">RNG Seed</span>
          <input
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
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
      </div>

      <p className="text-sm text-zinc-500">
        Same seed + same params = identical output every run
      </p>
    </section>
  );
}
