"use client";

import type { SegmentParams } from "../lib/core/segments";

/** Props for {@link BaseParamsForm}. */
export interface BaseParamsFormProps {
  value: Required<SegmentParams>;
  onChange: (value: Required<SegmentParams>) => void;
}

/** Numeric base-param fields edited by the form (excludes `trend`). */
const BASE_PARAM_FIELDS = [
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
] as const satisfies readonly (keyof SegmentParams)[];

type BaseParamField = (typeof BASE_PARAM_FIELDS)[number];

const ACRONYMS = new Set(["cod", "rto", "aov"]);

/** Humanizes a snake_case field name (e.g. `cod_rate` → `COD rate`). */
function humanizeField(field: string): string {
  return field
    .split("_")
    .map((part, index) => {
      if (ACRONYMS.has(part)) {
        return part.toUpperCase();
      }
      if (index === 0) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      return part;
    })
    .join(" ");
}

/** True for fields that use a 0–1 scale and decimal step. */
function isDecimalScaleField(field: BaseParamField): boolean {
  return (
    field.endsWith("_rate") ||
    field.endsWith("_probability") ||
    field === "evening_concentration"
  );
}

/** True when the field should show the "0 to 1" hint. */
function showRateHint(field: BaseParamField): boolean {
  return field.endsWith("_rate") || field.endsWith("_probability");
}

/**
 * Controlled grid of inputs for the 13 numeric {@link SegmentParams} fields
 * used as base generation values. Preserves `trend` on the value object.
 */
export function BaseParamsForm({ value, onChange }: BaseParamsFormProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Base parameters</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BASE_PARAM_FIELDS.map((field) => {
          const decimal = isDecimalScaleField(field);
          return (
            <label
              key={field}
              className="flex flex-col gap-1 text-sm text-zinc-700"
            >
              <span className="font-medium">
                {humanizeField(field)}
                {showRateHint(field) && (
                  <span className="ml-1 font-normal text-zinc-500">
                    (0 to 1)
                  </span>
                )}
              </span>
              <input
                type="number"
                step={decimal ? "0.01" : "1"}
                value={value[field]}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  onChange({
                    ...value,
                    [field]: Number.isFinite(parsed) ? parsed : 0,
                  });
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
