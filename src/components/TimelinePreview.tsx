import { buildDayMap, resolveParams } from "../lib/core/segments";
import { PROFILES } from "../lib/core/profiles/index";
import type { ParseResult } from "../lib/parser/index";

/** Props for {@link TimelinePreview}. */
export interface TimelinePreviewProps {
  parseResult: ParseResult;
  selectedScenario: string | null;
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
 * selected scenario base profile.
 */
export function TimelinePreview({
  parseResult,
  selectedScenario,
}: TimelinePreviewProps) {
  if (
    parseResult.errors.length > 0 ||
    !selectedScenario ||
    parseResult.segments.length === 0
  ) {
    return null;
  }

  const profile = PROFILES[selectedScenario];
  if (!profile) {
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
    profile.params,
    parseResult.segments,
  );

  const estimatedOrders = parseResult.segments.reduce((sum, segment) => {
    const resolved = resolveParams(profile.params, segment.params);
    const days = daysInclusive(segment.start_date, segment.end_date);
    return sum + resolved.orders_per_day_mean * days;
  }, 0);

  const rows = parseResult.segments.map((segment) => {
    const resolved = resolveParams(profile.params, segment.params);
    const days = daysInclusive(segment.start_date, segment.end_date);
    return { segment, resolved, days };
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Timeline preview</h2>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Days</th>
              <th className="px-3 py-2 font-medium">Orders/day</th>
              <th className="px-3 py-2 font-medium">COD rate</th>
              <th className="px-3 py-2 font-medium">Discount rate</th>
              <th className="px-3 py-2 font-medium">AOV mean</th>
              <th className="px-3 py-2 font-medium">New customer rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-900">
            {rows.map(({ segment, resolved, days }) => (
              <tr key={`${segment.start_date}-${segment.end_date}`}>
                <td className="px-3 py-2 font-mono text-xs">
                  {segment.start_date}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {segment.end_date}
                </td>
                <td className="px-3 py-2">{days}</td>
                <td className="px-3 py-2">
                  {resolved.orders_per_day_mean.toFixed(1)}
                </td>
                <td className="px-3 py-2">{formatRate(resolved.cod_rate)}</td>
                <td className="px-3 py-2">
                  {formatRate(resolved.discount_rate)}
                </td>
                <td className="px-3 py-2">₹{resolved.aov_mean.toFixed(0)}</td>
                <td className="px-3 py-2">
                  {formatRate(resolved.new_customer_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-sm text-zinc-600">
        <p>
          <span className="font-medium text-zinc-800">Total days in period:</span>{" "}
          {dayMap.size}
        </p>
        <p>
          <span className="font-medium text-zinc-800">
            Estimated total orders:
          </span>{" "}
          {Math.round(estimatedOrders).toLocaleString()} (rough estimate)
        </p>
        <p className="text-zinc-500">
          Actual output will vary due to RNG jitter and festival spikes
        </p>
      </div>
    </section>
  );
}
