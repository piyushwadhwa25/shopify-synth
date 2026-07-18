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
  "items_per_order_mean",
  "multi_unit_rate",
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

/** Fields that use a tenth-step (e.g. basket size means). */
function isTenthStepField(field: BaseParamField): boolean {
  return field === "items_per_order_mean";
}

/**
 * Controlled grid of inputs for the 13 numeric {@link SegmentParams} fields
 * used as base generation values. Preserves `trend` on the value object.
 */
export function BaseParamsForm({ value, onChange }: BaseParamsFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-sans text-sm font-semibold text-ink">
        Base parameters
      </h3>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {BASE_PARAM_FIELDS.map((field) => {
          const decimal = isDecimalScaleField(field);
          const tenthStep = isTenthStepField(field);
          const meta = PARAM_DESCRIPTIONS[field];
          const inputId = `param-${field}`;
          const showRateTrack = meta.range === "0 to 1";
          const numericValue = value[field];
          const clampedRate = Math.min(1, Math.max(0, numericValue));

          return (
            <div key={field} className="flex flex-col">
              <div className="mb-1.5 flex items-center gap-1">
                <label
                  htmlFor={inputId}
                  className="font-sans text-sm font-medium text-ink"
                >
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
                step={decimal ? "0.01" : tenthStep ? "0.1" : "1"}
                {...(field === "items_per_order_mean"
                  ? { min: 1, max: 3 }
                  : {})}
                value={numericValue}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  onChange({
                    ...value,
                    [field]: Number.isFinite(parsed) ? parsed : 0,
                  });
                }}
                className="rounded-md border border-line bg-white px-3 py-2 font-mono text-sm transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
              />
              {showRateTrack && (
                <div className="relative mt-1.5 h-1 rounded-full bg-line">
                  <div
                    className="absolute h-1 w-1.5 -translate-x-1/2 rounded-full bg-signal"
                    style={{ left: `${clampedRate * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
