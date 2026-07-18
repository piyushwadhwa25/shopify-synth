import { buildDayMap, resolveParams } from "../lib/core/segments";
import type { SegmentParams } from "../lib/core/segments";
import type { ParseResult } from "../lib/parser/index";

/** Props for {@link TimelinePreview}. */
export interface TimelinePreviewProps {
  parseResult: ParseResult;
  /** Base params used to resolve segment overrides in the preview table. */
  baseParams: Required<SegmentParams> | null;
}

/** Inclusive day count between two ISO dates. */
function daysInclusive(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

/** Formats a rate for table display as a percentage. */
function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Summary table of parsed segments with params resolved against the
 * current base parameters form values.
 */
export function TimelinePreview({
  parseResult,
  baseParams,
}: TimelinePreviewProps) {
  if (
    parseResult.errors.length > 0 ||
    !baseParams ||
    parseResult.segments.length === 0
  ) {
    return null;
  }

  const periodStart =
    parseResult.global?.period_start ??
    parseResult.segments.reduce(
      (min, s) => (s.start_date < min ? s.start_date : min),
      parseResult.segments[0].start_date,
    );
  const periodEnd =
    parseResult.global?.period_end ??
    parseResult.segments.reduce(
      (max, s) => (s.end_date > max ? s.end_date : max),
      parseResult.segments[0].end_date,
    );

  const dayMap = buildDayMap(
    periodStart,
    periodEnd,
    baseParams,
    parseResult.segments,
  );

  const estimatedOrders = parseResult.segments.reduce((sum, segment) => {
    const resolved = resolveParams(baseParams, segment.params);
    const days = daysInclusive(segment.start_date, segment.end_date);
    return sum + resolved.orders_per_day_mean * days;
  }, 0);

  const rows = parseResult.segments.map((segment) => {
    const resolved = resolveParams(baseParams, segment.params);
    const days = daysInclusive(segment.start_date, segment.end_date);
    return { segment, resolved, days };
  });

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-sm font-semibold text-ink">
        Timeline preview
      </h3>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="min-w-full text-left font-sans text-sm">
          <thead className="border-b border-line bg-signal-soft text-ink">
            <tr>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Days</th>
              <th className="px-3 py-2 font-medium">Orders/day</th>
              <th className="px-3 py-2 font-medium">COD rate</th>
              <th className="px-3 py-2 font-medium">Discount rate</th>
              <th className="px-3 py-2 font-medium">Items/order</th>
              <th className="px-3 py-2 font-medium">New customer rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink">
            {rows.map(({ segment, resolved, days }) => (
              <tr key={`${segment.start_date}-${segment.end_date}`}>
                <td className="px-3 py-2 font-mono text-xs">
                  {segment.start_date}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {segment.end_date}
                </td>
                <td className="px-3 py-2 font-mono text-sm">{days}</td>
                <td className="px-3 py-2 font-mono text-sm">
                  {resolved.orders_per_day_mean.toFixed(1)}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {formatRate(resolved.cod_rate)}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {formatRate(resolved.discount_rate)}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {resolved.items_per_order_mean.toFixed(1)}
                </td>
                <td className="px-3 py-2 font-mono text-sm">
                  {formatRate(resolved.new_customer_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 font-sans text-xs text-ink-muted">
        <p>
          <span className="font-medium text-ink">Total days in period:</span>{" "}
          {dayMap.size}
        </p>
        <p>
          <span className="font-medium text-ink">Estimated total orders:</span>{" "}
          {Math.round(estimatedOrders).toLocaleString()} (rough estimate)
        </p>
        <p>
          Actual output will vary due to RNG jitter and festival spikes
        </p>
      </div>
    </div>
  );
}
