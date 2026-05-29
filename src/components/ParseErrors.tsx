import type { ParseError, ParseWarning } from "../lib/parser/index";

/** Props for {@link ParseErrors}. */
export interface ParseErrorsProps {
  errors: ParseError[];
  warnings: ParseWarning[];
}

/**
 * Displays parser errors (red) and non-blocking warnings (amber)
 * from a {@link ParseResult}.
 */
export function ParseErrors({ errors, warnings }: ParseErrorsProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">Errors</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
            {errors.map((error, index) => (
              <li key={`${error.row}-${error.column ?? "row"}-${index}`}>
                {error.row > 0 ? `Row ${error.row}: ` : ""}
                {error.column ? `${error.column} — ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800">Warnings</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
            {warnings.map((warning, index) => (
              <li key={`warning-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
