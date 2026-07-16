"use client";

import type { ComparisonRow } from "../lib/core/compareParams";

/** Props for {@link ComparisonTable}. */
export interface ComparisonTableProps {
  rows: ComparisonRow[];
}

/** Formats a value according to the comparison row's unit. */
function formatByUnit(
  value: number,
  unit: ComparisonRow["unit"],
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (unit === "rate") {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (unit === "currency") {
    return `₹${value.toFixed(2)}`;
  }
  return value.toFixed(2);
}

/** Formats a signed difference with the same unit rules. */
function formatDifference(
  value: number,
  unit: ComparisonRow["unit"],
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const formatted = formatByUnit(Math.abs(value), unit);
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/** Inline checkmark icon (Tabler ti-check equivalent). */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-green-600"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** Inline warning triangle (Tabler ti-alert-triangle equivalent). */
function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-600"
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

/**
 * Table of Expected vs Actual parameter comparisons from
 * {@link compareParams}.
 */
export function ComparisonTable({ rows }: ComparisonTableProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Expected vs actual
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Compares your input parameters against what the generated dataset
          actually contains, using the real per-day values the generator used
          (not a re-simulation).
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 font-medium">Param</th>
              <th className="px-3 py-2 font-medium">Expected</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Difference</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-900">
            {rows.map((row) => {
              const actualNaN = !Number.isFinite(row.actual);
              return (
                <tr key={row.param}>
                  <td className="px-3 py-2 align-top">
                    <span className="font-medium">{row.param}</span>
                    {row.note && (
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {row.note}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                    {formatByUnit(row.expected, row.unit)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                    {actualNaN ? "—" : formatByUnit(row.actual, row.unit)}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-xs tabular-nums ${
                      actualNaN
                        ? "text-zinc-400"
                        : row.withinTolerance
                          ? "text-zinc-500"
                          : "text-red-600"
                    }`}
                  >
                    {actualNaN
                      ? "—"
                      : formatDifference(row.difference, row.unit)}
                  </td>
                  <td className="px-3 py-2">
                    {actualNaN ? (
                      <span className="text-zinc-400">—</span>
                    ) : row.withinTolerance ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckIcon />
                        <span className="sr-only">Within tolerance</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertIcon />
                        <span className="sr-only">Outside tolerance</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
