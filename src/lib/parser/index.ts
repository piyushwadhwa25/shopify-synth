import type { Segment, GlobalPeriod, SegmentParams } from "../core/segments.js";
import { validateSegments } from "../core/segments.js";

/** Maximum parse errors collected before stopping and appending a summary message. */
const MAX_ERRORS = 10;

/** Segment parameter columns that must be rates in [0, 1]. */
const RATE_COLUMNS = new Set([
  "new_customer_rate",
  "repeat_purchase_probability",
  "cod_rate",
  "cod_rto_rate",
  "prepaid_refund_rate",
  "discount_rate",
  "evening_concentration",
]);

/** Segment parameter columns that must be numeric and >= 0. */
const NON_NEGATIVE_COLUMNS = new Set([
  "orders_per_day_mean",
  "orders_per_day_std",
  "discount_amount_mean",
  "aov_mean",
  "aov_std",
]);

/** All segment parameter column names recognized in the paste header. */
const PARAM_COLUMNS = new Set([
  ...RATE_COLUMNS,
  ...NON_NEGATIVE_COLUMNS,
  "weekend_multiplier",
]);

/** The result of a parse attempt. */
export interface ParseResult {
  segments: Segment[];
  /** `null` when no global row was pasted and the caller has not supplied a period yet. */
  global: GlobalPeriod | null;
  /** Empty when the paste is fully valid. */
  errors: ParseError[];
  /** Non-blocking issues worth surfacing (e.g. gaps between segments). */
  warnings: ParseWarning[];
}

/** A parse error. Row is 1-indexed to match what the user sees in the textarea. */
export interface ParseError {
  row: number;
  /** Which column caused the error; `null` for row-level or engine validation errors. */
  column: string | null;
  message: string;
}

/** A non-blocking warning, e.g. a gap between consecutive segments. */
export interface ParseWarning {
  message: string;
}

/**
 * Parses raw pasted text into segments, an optional global period, errors, and warnings.
 *
 * @param raw - CSV-style text from the UI textarea.
 * @param fallbackGlobal - Generation window used for `validateSegments` when no global row is present.
 */
export function parsePaste(
  raw: string,
  fallbackGlobal?: GlobalPeriod,
): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const segments: Segment[] = [];
  let global: GlobalPeriod | null = null;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    addError(errors, 1, null, "Paste is empty");
    return { segments, global: null, errors, warnings };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());

  if (!headers.includes("start_date")) {
    addError(errors, 1, "start_date", 'Header must include a "start_date" column');
  }

  for (let i = 1; i < lines.length; i++) {
    if (atErrorLimit(errors)) {
      break;
    }

    const rowIndex = i + 1;
    const cells = splitCsvLine(lines[i]);
    const startDateIdx = headers.indexOf("start_date");
    const startDateValue =
      startDateIdx >= 0 && startDateIdx < cells.length
        ? cells[startDateIdx].trim().toLowerCase()
        : "";

    if (startDateValue === "global") {
      if (global) {
        addError(errors, rowIndex, "start_date", "Only one global row is allowed");
        continue;
      }
      const parsed = parseGlobalRow(lines[i], rowIndex, errors);
      if (parsed) {
        global = parsed;
      }
      continue;
    }

    const segment = parseSegmentRow(lines[i], headers, rowIndex, errors);
    if (segment) {
      segments.push(segment);
    }
  }

  const validationGlobal = global ?? fallbackGlobal;
  if (validationGlobal && !atErrorLimit(errors)) {
    const validationMessages = validateSegments(segments, validationGlobal);
    for (const message of validationMessages) {
      if (!addError(errors, 0, null, message)) {
        break;
      }
    }
  }

  if (!atErrorLimit(errors)) {
    warnings.push(...findGaps(segments));
  }

  return { segments, global, errors, warnings };
}

/**
 * Parses a single data row into a `Segment` using the header columns.
 * Returns `null` and appends to `errors` when the row cannot be parsed.
 */
function parseSegmentRow(
  row: string,
  headers: string[],
  rowIndex: number,
  errors: ParseError[],
): Segment | null {
  if (atErrorLimit(errors)) {
    return null;
  }

  const cells = splitCsvLine(row);
  const getCell = (column: string): string | undefined => {
    const idx = headers.indexOf(column);
    if (idx < 0 || idx >= cells.length) {
      return undefined;
    }
    return cells[idx].trim();
  };

  const startDate = getCell("start_date");
  const endDate = getCell("end_date");

  if (!startDate) {
    addError(errors, rowIndex, "start_date", "start_date is required");
    return null;
  }
  if (!endDate) {
    addError(errors, rowIndex, "end_date", "end_date is required");
    return null;
  }

  if (!isValidDate(startDate)) {
    addError(
      errors,
      rowIndex,
      "start_date",
      `Invalid date "${startDate}" — expected YYYY-MM-DD`,
    );
    return null;
  }
  if (!isValidDate(endDate)) {
    addError(
      errors,
      rowIndex,
      "end_date",
      `Invalid date "${endDate}" — expected YYYY-MM-DD`,
    );
    return null;
  }

  const params: SegmentParams = {};
  let rowValid = true;

  for (const column of headers) {
    if (!PARAM_COLUMNS.has(column)) {
      continue;
    }

    const rawValue = getCell(column);
    if (rawValue === undefined || rawValue === "") {
      continue;
    }

    const value = parseNumber(rawValue);
    if (value === null) {
      rowValid = false;
      addError(
        errors,
        rowIndex,
        column,
        `"${rawValue}" is not a valid number`,
      );
      continue;
    }

    if (RATE_COLUMNS.has(column)) {
      if (value < 0 || value > 1) {
        rowValid = false;
        addError(
          errors,
          rowIndex,
          column,
          `${column} must be in [0, 1], got ${value}`,
        );
        continue;
      }
    } else if (NON_NEGATIVE_COLUMNS.has(column)) {
      if (value < 0) {
        rowValid = false;
        addError(
          errors,
          rowIndex,
          column,
          `${column} must be >= 0, got ${value}`,
        );
        continue;
      }
    }

    (params as Record<string, number>)[column] = value;
  }

  if (!rowValid || atErrorLimit(errors)) {
    return null;
  }

  return {
    start_date: startDate,
    end_date: endDate,
    params,
  };
}

/**
 * Parses the special global row (`start_date` = `"global"`).
 * Remaining cells use `key=value` pairs: `period_start`, `period_end`, and `seed`.
 */
function parseGlobalRow(
  row: string,
  rowIndex: number,
  errors: ParseError[],
): GlobalPeriod | null {
  if (atErrorLimit(errors)) {
    return null;
  }

  const cells = splitCsvLine(row);
  const fields: Partial<Record<keyof GlobalPeriod, string>> = {};

  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed || trimmed.toLowerCase() === "global") {
      continue;
    }

    // Each non-global cell is a key=value pair (e.g. period_start=2025-06-01).
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      addError(
        errors,
        rowIndex,
        null,
        `Expected key=value pair, got "${trimmed}"`,
      );
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key === "period_start" || key === "period_end" || key === "seed") {
      fields[key] = value;
    } else {
      addError(errors, rowIndex, null, `Unknown global field "${key}"`);
    }
  }

  const periodStart = fields.period_start;
  const periodEnd = fields.period_end;
  const seedRaw = fields.seed;

  if (!periodStart) {
    addError(errors, rowIndex, null, "global row missing period_start=...");
  }
  if (!periodEnd) {
    addError(errors, rowIndex, null, "global row missing period_end=...");
  }
  if (!seedRaw) {
    addError(errors, rowIndex, null, "global row missing seed=...");
  }

  if (!periodStart || !periodEnd || !seedRaw) {
    return null;
  }

  if (!isValidDate(periodStart)) {
    addError(
      errors,
      rowIndex,
      null,
      `Invalid period_start "${periodStart}" — expected YYYY-MM-DD`,
    );
  }
  if (!isValidDate(periodEnd)) {
    addError(
      errors,
      rowIndex,
      null,
      `Invalid period_end "${periodEnd}" — expected YYYY-MM-DD`,
    );
  }

  const seed = parseNumber(seedRaw);
  if (seed === null || !Number.isInteger(seed)) {
    addError(
      errors,
      rowIndex,
      null,
      `seed must be an integer, got "${seedRaw}"`,
    );
  }

  if (atErrorLimit(errors)) {
    return null;
  }

  if (
    !isValidDate(periodStart) ||
    !isValidDate(periodEnd) ||
    seed === null ||
    !Number.isInteger(seed)
  ) {
    return null;
  }

  return {
    period_start: periodStart,
    period_end: periodEnd,
    seed,
  };
}

/**
 * Checks for date gaps between consecutive segments (in paste order).
 * A gap exists when `segment[n].end_date` + 1 day ≠ `segment[n+1].start_date`.
 */
function findGaps(segments: Segment[]): ParseWarning[] {
  const warnings: ParseWarning[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    if (
      !isValidDate(current.end_date) ||
      !isValidDate(next.start_date)
    ) {
      continue;
    }

    const dayAfterEnd = addDays(current.end_date, 1);
    if (dayAfterEnd !== next.start_date) {
      warnings.push({
        message: `Gap between segments: ${current.end_date} ends but ${next.start_date} does not follow the next day (missing ${dayAfterEnd})`,
      });
    }
  }

  return warnings;
}

/** Converts a trimmed cell string to a number; returns `null` when not parseable. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Returns true when `value` is a valid ISO date (`YYYY-MM-DD`). */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === value;
}

/** Splits a CSV line on commas and trims each cell. */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

/** Advances an ISO date string by `days` (UTC-safe). */
function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Returns true when no more errors should be collected. */
function atErrorLimit(errors: ParseError[]): boolean {
  return errors.length >= MAX_ERRORS;
}

/** Appends a parse error, enforcing the max-error cap and summary message. */
function addError(
  errors: ParseError[],
  row: number,
  column: string | null,
  message: string,
): boolean {
  if (atErrorLimit(errors)) {
    return false;
  }

  errors.push({ row, column, message });

  if (errors.length >= MAX_ERRORS) {
    errors.push({
      row,
      column: null,
      message: "Too many errors — fix the above and re-parse",
    });
  }

  return !atErrorLimit(errors);
}
