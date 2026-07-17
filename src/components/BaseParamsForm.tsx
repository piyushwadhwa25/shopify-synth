"use client";

import { InfoTooltip } from "./InfoTooltip";
import { PARAM_DESCRIPTIONS } from "../lib/content/paramDescriptions";
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

/** True for fields that use a 0–1 scale and decimal step. */
function isDecimalScaleField(field: BaseParamField): boolean {
  return (
    field.endsWith("_rate") ||
    field.endsWith("_probability") ||
    field === "evening_concentration"
  );
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
          const meta = PARAM_DESCRIPTIONS[field];
          const inputId = `param-${field}`;

          return (
            <div
              key={field}
              className="flex flex-col gap-1 text-sm text-zinc-700"
            >
              <div className="flex items-center gap-1">
                <label htmlFor={inputId} className="font-medium">
                  {meta.label}
                </label>
                <InfoTooltip
                  description={meta.description}
                  range={meta.range}
                />
              </div>
              <input
                id={inputId}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
