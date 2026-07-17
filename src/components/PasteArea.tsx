"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PARAM_DESCRIPTIONS } from "../lib/content/paramDescriptions";
import {
  parsePaste,
  type ParseResult,
} from "../lib/parser/index";
import type { GlobalPeriod } from "../lib/core/segments";
import { ParseErrors } from "./ParseErrors";

/** Full column header row for copy-to-clipboard and preset rows. */
export const PASTE_HEADER =
  "start_date,end_date,orders_per_day_mean,orders_per_day_std,new_customer_rate,repeat_purchase_probability,cod_rate,cod_rto_rate,prepaid_refund_rate,discount_rate,discount_amount_mean,aov_mean,aov_std,weekend_multiplier,evening_concentration";

/** Props for {@link PasteArea}. */
export interface PasteAreaProps {
  globalPeriod: GlobalPeriod;
  onParsed: (result: ParseResult) => void;
  /** When set, replaces textarea content (e.g. scenario preset load). */
  presetRaw?: string;
}

/**
 * CSV paste textarea with manual and debounced auto-parse,
 * clipboard header copy, and inline validation feedback.
 */
export function PasteArea({
  globalPeriod,
  onParsed,
  presetRaw,
}: PasteAreaProps) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy header");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runParse = useCallback(
    (text: string) => {
      const parsed = parsePaste(text, globalPeriod);
      setResult(parsed);
      onParsed(parsed);
      return parsed;
    },
    [globalPeriod, onParsed],
  );

  const scheduleParse = useCallback(
    (text: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        runParse(text);
      }, 100);
    },
    [runParse],
  );

  useEffect(() => {
    if (presetRaw !== undefined) {
      setRaw(presetRaw);
    }
  }, [presetRaw]);

  useEffect(() => {
    if (!raw.trim()) {
      // Empty paste = no overrides; keep parent in sync with a valid empty result.
      runParse("");
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }
    scheduleParse(raw);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [raw, globalPeriod, scheduleParse, runParse]);

  const handleCopyHeader = async () => {
    try {
      await navigator.clipboard.writeText(PASTE_HEADER);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy header"), 2000);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy header"), 2000);
    }
  };

  const handleParseClick = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    runParse(raw.trim() ? raw : "");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    window.setTimeout(() => {
      scheduleParse(textarea.value);
    }, 0);
  };

  const isValid = result !== null && result.errors.length === 0 && raw.trim() !== "";
  const coverage =
    isValid && result.segments.length > 0
      ? {
          start: result.segments.reduce(
            (min, s) => (s.start_date < min ? s.start_date : min),
            result.segments[0].start_date,
          ),
          end: result.segments.reduce(
            (max, s) => (s.end_date > max ? s.end_date : max),
            result.segments[0].end_date,
          ),
        }
      : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Paste segment timeline
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            One row per time window. Header row required. Columns: start_date,
            end_date, then any params you want to override. Use a row with
            start_date=global to set the generation period.
          </p>

          <div className="mt-3 max-w-2xl">
            <button
              type="button"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((open) => !open)}
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              What do these columns mean?
            </button>
            {columnsOpen && (
              <ul className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                <li>
                  <span className="font-medium text-zinc-900">start_date</span>
                  <span className="mt-0.5 block text-xs text-zinc-600">
                    First day this override applies. Use &apos;global&apos; to
                    apply for the entire generation period.
                  </span>
                </li>
                <li>
                  <span className="font-medium text-zinc-900">end_date</span>
                  <span className="mt-0.5 block text-xs text-zinc-600">
                    Last day this override applies (inclusive).
                  </span>
                </li>
                {Object.entries(PARAM_DESCRIPTIONS).map(([key, meta]) => (
                  <li key={key}>
                    <span className="font-medium text-zinc-900">
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      {meta.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyHeader}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {copyLabel}
        </button>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onPaste={handlePaste}
        rows={8}
        className="w-full min-h-[8rem] rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900"
        placeholder={PASTE_HEADER}
        spellCheck={false}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleParseClick}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Parse
        </button>
      </div>

      {result && (result.errors.length > 0 || result.warnings.length > 0) && (
        <ParseErrors errors={result.errors} warnings={result.warnings} />
      )}

      {isValid && coverage && (
        <p className="text-sm font-medium text-green-700" role="status">
          {result.segments.length} segment
          {result.segments.length === 1 ? "" : "s"} parsed. Covering{" "}
          {coverage.start} to {coverage.end}.
        </p>
      )}
    </section>
  );
}
