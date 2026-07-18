"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parsePaste,
  type ParseResult,
} from "../lib/parser/index";
import type { GlobalPeriod } from "../lib/core/segments";
import { ParseErrors } from "./ParseErrors";

/** Full column header row for copy-to-clipboard and preset rows. */
export const PASTE_HEADER =
  "start_date,end_date,orders_per_day_mean,orders_per_day_std,new_customer_rate,repeat_purchase_probability,cod_rate,cod_rto_rate,prepaid_refund_rate,discount_rate,discount_amount_mean,items_per_order_mean,multi_unit_rate,weekend_multiplier,evening_concentration";

/**
 * Illustrative paste with two independent override windows.
 * Blank cells inherit from base parameters above.
 * Row 1: discount_rate=0.35, items_per_order_mean=2.1 (Oct 15 to Nov 5).
 * Row 2: orders_per_day_mean=20 (Jan 5 to Jan 20).
 */
const EXAMPLE_TIMELINE = `${PASTE_HEADER}
${[
  "2025-10-15",
  "2025-11-05",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "0.35",
  "",
  "2.1",
  "",
  "",
  "",
].join(",")}
${[
  "2026-01-05",
  "2026-01-20",
  "20",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
].join(",")}`;

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
    <div className="space-y-4">
      <p className="mb-1 font-sans text-sm text-ink-muted">
        Your parameters above describe an ordinary day. Some days aren&apos;t
        ordinary: a festival spike, a discount push, a slow decline. Paste
        one row per time window below to change specific parameters for
        that window only.
      </p>
      <p className="mb-1 font-sans text-sm text-ink-muted">
        You can add as many rows as you need, each covering a different date
        range. Anything left blank in a row keeps reading from the
        parameters above.
      </p>
      <p className="mb-6 font-sans text-sm text-ink-muted">
        Leave this empty to generate the full period using only your
        parameters above. This section is optional.
      </p>

      <div className="-rotate-[0.75deg] mb-6 rounded-xl border border-dashed border-line bg-signal-soft/40 p-4">
        <div className="mb-3 font-mono text-xs tracking-widest text-ink-muted">
          EXAMPLE: TWO SEPARATE OVERRIDE WINDOWS
        </div>
        <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <span className="font-mono text-signal">discount_rate</span>
          <span className="font-sans text-ink-muted">
            0.12 to 0.35 for Oct 15 to Nov 5, then back to 0.12
          </span>
          <span className="font-mono text-signal">items_per_order_mean</span>
          <span className="font-sans text-ink-muted">
            1.3 to 2.1 for Oct 15 to Nov 5, then back to 1.3
          </span>
        </div>
        <div className="mb-4 h-px bg-line" />
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <span className="font-mono text-signal">orders_per_day_mean</span>
          <span className="font-sans text-ink-muted">
            35 to 20 for Jan 5 to Jan 20, a separate post-festival slowdown
          </span>
          <span className="font-mono text-ink-muted">everything else</span>
          <span className="font-sans text-ink-muted">
            unchanged in both windows, still reads from your parameters above
          </span>
        </div>
        <p className="mt-4 font-sans text-xs text-ink-muted">
          These are two independent rows in one paste. Add a third, a tenth,
          however many time windows this dataset needs.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleCopyHeader}
          className="font-sans text-sm text-signal underline transition-colors hover:text-ink"
        >
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={() => setRaw(EXAMPLE_TIMELINE)}
          className="font-sans text-sm text-signal underline hover:text-ink"
        >
          Load this example
        </button>
      </div>

      <div>
        <div className="rounded-t-sm bg-ink px-3 py-1.5 font-mono text-xs tracking-widest text-paper">
          OVERRIDES.CSV
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onPaste={handlePaste}
          rows={8}
          className="min-h-32 w-full rounded-t-none rounded-b-sm border-2 border-t-0 border-ink/15 bg-[#F5F4EF] p-3 font-mono text-sm shadow-inner focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
          placeholder="Paste rows here, or click 'Load this example' above."
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleParseClick}
          className="rounded-md bg-signal px-5 py-2.5 font-sans font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Parse
        </button>
      </div>

      {result && (result.errors.length > 0 || result.warnings.length > 0) && (
        <ParseErrors errors={result.errors} warnings={result.warnings} />
      )}

      {isValid && coverage && (
        <p className="font-sans text-sm font-medium text-success" role="status">
          {result.segments.length} segment
          {result.segments.length === 1 ? "" : "s"} parsed. Covering{" "}
          {coverage.start} to {coverage.end}.
        </p>
      )}
    </div>
  );
}
