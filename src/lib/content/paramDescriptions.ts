/**
 * Human-facing copy for base generation parameters (labels, tooltips, ranges).
 */

/** Tooltip / label content for one base parameter field. */
export interface ParamDescription {
  label: string;
  description: string;
  range?: string;
}

/**
 * Descriptions keyed by {@link SegmentParams} field name.
 * Used by {@link BaseParamsForm} labels and {@link InfoTooltip}.
 */
export const PARAM_DESCRIPTIONS: Record<string, ParamDescription> = {
  orders_per_day_mean: {
    label: "Orders per day (mean)",
    description:
      "Average number of orders generated per day, before weekend and festival adjustments are applied.",
  },
  orders_per_day_std: {
    label: "Orders per day (std)",
    description:
      "How much daily order count varies around the mean. Higher values create bigger day-to-day swings in volume; lower values keep daily counts tighter to the mean.",
  },
  new_customer_rate: {
    label: "New customer rate",
    description:
      "Share of orders placed by a brand-new customer instead of someone from the existing customer pool.",
    range: "0 to 1",
  },
  repeat_purchase_probability: {
    label: "Repeat purchase probability",
    description:
      "For an order that could go to a returning customer, the chance that customer actually returns. If this roll fails, the order goes to a new customer instead — a low value here pushes more orders toward new customers even when new_customer_rate is low.",
    range: "0 to 1",
  },
  cod_rate: {
    label: "COD rate",
    description:
      "Share of orders paid via Cash on Delivery instead of a prepaid gateway (UPI, cards, wallets).",
    range: "0 to 1",
  },
  cod_rto_rate: {
    label: "COD RTO rate",
    description:
      "Of COD orders only, the share marked Return to Origin (RTO) — refused or undelivered on arrival. Does not apply to prepaid orders.",
    range: "0 to 1",
  },
  prepaid_refund_rate: {
    label: "Prepaid refund rate",
    description:
      "Of prepaid orders only, the share that end up refunded. Does not apply to COD orders.",
    range: "0 to 1",
  },
  discount_rate: {
    label: "Discount rate",
    description: "Share of all orders that receive a discount.",
    range: "0 to 1",
  },
  discount_amount_mean: {
    label: "Discount amount (mean)",
    description:
      "Average ₹ amount taken off when an order does get a discount. The actual discount is randomized around this and can never exceed 90% of that order's subtotal.",
  },
  aov_mean: {
    label: "AOV (mean)",
    description:
      "Target average order value. Also acts as a soft ceiling — baskets that overshoot this get resampled, and individual line-item prices are capped near this value.",
  },
  aov_std: {
    label: "AOV (std)",
    description:
      "How tightly order values cluster around AOV mean. A tighter value rejects baskets that stray further from the target; a wider value tolerates more variance before resampling.",
  },
  weekend_multiplier: {
    label: "Weekend multiplier",
    description:
      "Multiplies the day's order volume on Saturdays and Sundays. 1.0 = no weekend effect, 2.0 = double the weekday volume.",
  },
  evening_concentration: {
    label: "Evening concentration",
    description:
      "Share of each day's orders placed between 6 PM and 11 PM IST, versus daytime (8 AM–6 PM).",
    range: "0 to 1",
  },
};
