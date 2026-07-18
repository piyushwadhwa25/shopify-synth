import { generate } from "../src/lib/core/generate";
import type { CatalogProduct, GeneratorInput } from "../src/lib/core/generate";
import { parsePaste } from "../src/lib/parser/index";
import { parseProductCSV } from "../src/lib/parser/product-csv";
import { PROFILES } from "../src/lib/core/profiles/index";
import type { FestivalSpike } from "../src/lib/core/timestamps";
import type { SegmentParams } from "../src/lib/core/segments";
import { validateBaseParams } from "../src/lib/core/validate-base-params";
import * as fs from "fs";
import * as path from "path";

/** Standard India festival spikes (same defaults as the web UI). */
const STANDARD_FESTIVAL_SPIKES: FestivalSpike[] = [
  {
    label: "Diwali 2025",
    start_date: "2025-10-15",
    end_date: "2025-11-05",
    multiplier: 3.5,
  },
  {
    label: "Valentine's 2026",
    start_date: "2026-02-10",
    end_date: "2026-02-14",
    multiplier: 2.0,
  },
  {
    label: "Holi 2026",
    start_date: "2026-03-12",
    end_date: "2026-03-15",
    multiplier: 1.8,
  },
  {
    label: "New Year 2026",
    start_date: "2025-12-28",
    end_date: "2026-01-02",
    multiplier: 2.5,
  },
];

const VALID_PROFILES = Object.keys(PROFILES);

/** Numeric fields expected in a `--params` JSON file. */
const PARAM_NUMERIC_KEYS = [
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

/**
 * Parses `process.argv` into a flat flags map (`--key` → value).
 * Boolean flags without a following value are stored as `"true"`.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  // Skip `node` and script path — only process user-supplied args.
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Only tokens starting with `--` are flags; everything else is ignored.
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[i + 1];

    // If the next token exists and is not another flag, treat it as this flag's value.
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = "true";
    }
  }

  return flags;
}

/** Prints CLI usage and exits. */
function printUsage(): void {
  console.log(`
shopify-synth — generate synthetic Shopify store JSON

Usage:
  npx tsx scripts/cli.ts --profile <name> --catalog <csv> --output <path>
  npx tsx scripts/cli.ts --params <json> --catalog <csv> --output <path>
  npx tsx scripts/cli.ts --params <json> --config <path> --catalog <csv> --output <path>

Flags:
  --params <path>    Required<SegmentParams> JSON (13 numeric fields + optional trend)
  --profile <name>   Quick-fill params from preset: ${VALID_PROFILES.join(", ")}
                     Uses period 2025-06-01 → 2026-02-28, seed 42, empty segments
  --config <path>    Optional GeneratorInput JSON for global/segments/spikes
                     (base params still come from --params or --profile)
  --catalog <path>   Shopify product export CSV (required)
  --output <path>    Output file path (required)
  --help             Show this message

Examples:
  npx tsx scripts/cli.ts --profile bloom --catalog ./products.csv --output ./bloom.json
  npx tsx scripts/cli.ts --params ./my-params.json --catalog ./products.csv --output ./out.json
  npm run generate -- --profile bloom --catalog ./products.csv --output ./bloom.json
`);
}

/**
 * Loads and validates a {@link Required<SegmentParams>} JSON file.
 *
 * @param paramsPath - Path to the params JSON.
 */
function loadParamsFile(paramsPath: string): Required<SegmentParams> {
  const resolved = path.resolve(paramsPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: params file not found: ${resolved}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  } catch (err) {
    console.error(
      `Error: failed to parse params JSON at ${resolved}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error(`Error: params file must be a JSON object: ${resolved}`);
    process.exit(1);
  }

  const raw = parsed as Record<string, unknown>;
  for (const key of PARAM_NUMERIC_KEYS) {
    if (typeof raw[key] !== "number" || !Number.isFinite(raw[key] as number)) {
      console.error(
        `Error: params.${key} must be a finite number in ${resolved}`,
      );
      process.exit(1);
    }
  }

  const params: Required<SegmentParams> = {
    orders_per_day_mean: raw.orders_per_day_mean as number,
    orders_per_day_std: raw.orders_per_day_std as number,
    new_customer_rate: raw.new_customer_rate as number,
    repeat_purchase_probability: raw.repeat_purchase_probability as number,
    cod_rate: raw.cod_rate as number,
    cod_rto_rate: raw.cod_rto_rate as number,
    prepaid_refund_rate: raw.prepaid_refund_rate as number,
    discount_rate: raw.discount_rate as number,
    discount_amount_mean: raw.discount_amount_mean as number,
    items_per_order_mean: raw.items_per_order_mean as number,
    multi_unit_rate: raw.multi_unit_rate as number,
    weekend_multiplier: raw.weekend_multiplier as number,
    evening_concentration: raw.evening_concentration as number,
    trend:
      raw.trend && typeof raw.trend === "object"
        ? (raw.trend as Required<SegmentParams>["trend"])
        : { mode: "flat", strength: 0 },
  };

  const errors = validateBaseParams(params);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  return params;
}

/**
 * Resolves base params from `--params` (preferred) or `--profile` quick-fill.
 */
function resolveBaseParams(flags: Record<string, string>): Required<SegmentParams> {
  if (flags.params) {
    return loadParamsFile(flags.params);
  }

  const profile = PROFILES[flags.profile];
  if (!profile) {
    throw new Error(
      `Unknown profile "${flags.profile}". Valid profiles: ${VALID_PROFILES.join(", ")}`,
    );
  }
  return profile.params;
}

/**
 * Builds a default {@link GeneratorInput} using resolved base params.
 *
 * @param params - Base generation parameters.
 * @param catalog - Products from a Shopify export CSV (required).
 * @param scenarioLabel - Label written to `base.scenario` / download context.
 */
function buildDefaultInput(
  params: Required<SegmentParams>,
  catalog: CatalogProduct[],
  scenarioLabel: string,
): GeneratorInput {
  const storeId = catalog[0]?.store_id ?? "custom-store";

  return {
    global: {
      period_start: "2025-06-01",
      period_end: "2026-02-28",
      seed: 42,
    },
    base: {
      scenario: scenarioLabel,
      store_id: storeId,
      params,
    },
    segments: [],
    spikes: STANDARD_FESTIVAL_SPIKES,
    catalog,
    collections: [],
  };
}

/**
 * Reads and parses a config file as {@link GeneratorInput} (without catalog).
 * Catalog must be supplied separately via `--catalog`.
 *
 * @param configPath - Path to a JSON file.
 */
function loadConfigInput(configPath: string): Omit<
  GeneratorInput,
  "catalog" | "collections"
> &
  Partial<Pick<GeneratorInput, "catalog" | "collections">> {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  } catch (err) {
    throw new Error(
      `Failed to parse config JSON at ${resolved}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Config must be a JSON object: ${resolved}`);
  }

  const input = parsed as GeneratorInput;
  if (!input.global || !input.base || !Array.isArray(input.segments)) {
    throw new Error(
      `Config must include global, base, and segments[]: ${resolved}`,
    );
  }
  if (!Array.isArray(input.spikes)) {
    throw new Error(`Config must include spikes[]: ${resolved}`);
  }

  return input;
}

/**
 * Derives a store id slug from a catalog file path (matches UI upload behavior).
 */
function storeIdFromCatalogPath(catalogPath: string): string {
  const base = path
    .basename(catalogPath)
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "custom-store";
}

/**
 * Loads and parses a Shopify product export CSV into catalog products.
 *
 * @param catalogPath - Path to the CSV file.
 */
function loadCatalogCsv(catalogPath: string): CatalogProduct[] {
  const resolved = path.resolve(catalogPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: catalog file not found: ${resolved}`);
    process.exit(1);
  }

  const text = fs.readFileSync(resolved, "utf-8");
  const storeId = storeIdFromCatalogPath(resolved);
  const { catalog, warnings } = parseProductCSV(text, storeId);

  for (const warning of warnings) {
    console.error(`Warning: ${warning}`);
  }

  if (catalog.length === 0) {
    console.error(
      "Error: catalog CSV produced 0 products (need rows with Variant SKU).",
    );
    process.exit(1);
  }

  return catalog;
}

/**
 * CLI entry: parse flags, run {@link generate}, write output JSON.
 */
async function main(): Promise<void> {
  void parsePaste;

  const flags = parseArgs(process.argv);

  if (flags.help === "true") {
    printUsage();
    process.exit(0);
  }

  const outputPath = flags.output;
  if (!outputPath) {
    console.error("Error: --output <path> is required.");
    printUsage();
    process.exit(1);
  }

  if (!flags.catalog) {
    console.error(
      "Error: --catalog is required. shopify-synth no longer includes built-in products.",
    );
    process.exit(1);
  }

  const hasParams = flags.params !== undefined;
  const hasProfile = flags.profile !== undefined;

  if (!hasParams && !hasProfile) {
    console.error(
      "Provide --params <file> with explicit values, or --profile <id> to quick-fill from a preset (src/lib/core/profiles/).",
    );
    process.exit(1);
  }

  const catalog = loadCatalogCsv(flags.catalog);
  const params = resolveBaseParams(flags);
  const scenarioLabel = hasParams
    ? "custom"
    : (PROFILES[flags.profile]?.scenario ?? flags.profile);

  let input: GeneratorInput;

  if (flags.config) {
    const config = loadConfigInput(flags.config);
    const storeId = catalog[0]?.store_id ?? config.base.store_id;
    input = {
      global: config.global,
      base: {
        ...config.base,
        scenario: scenarioLabel,
        store_id: storeId,
        params,
      },
      segments: config.segments,
      spikes: config.spikes,
      catalog,
      collections: [],
    };
  } else {
    input = buildDefaultInput(params, catalog, scenarioLabel);
  }

  const output = generate(input);
  const resolvedOutput = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedOutput);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(resolvedOutput, JSON.stringify(output, null, 2), "utf-8");

  console.log(
    `Done. ${output.orders.length} orders, ${output.customers.length} customers, ${output.products.length} products → ${resolvedOutput}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
