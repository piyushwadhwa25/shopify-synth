import { generate } from "../src/lib/core/generate";
import type { GeneratorInput } from "../src/lib/core/generate";
import { getScenarioCatalog } from "../src/lib/core/catalogs";
import { parsePaste } from "../src/lib/parser/index";
import { PROFILES } from "../src/lib/core/profiles/index";
import type { FestivalSpike } from "../src/lib/core/timestamps";
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
  npx ts-node scripts/cli.ts --profile <name> --output <path>
  npx ts-node scripts/cli.ts --config <path> --output <path>

Flags:
  --profile <name>   Built-in profile: ${VALID_PROFILES.join(", ")}
                     Uses period 2025-06-01 → 2026-02-28, seed 42, empty segments
  --config <path>    Full GeneratorInput JSON file
  --output <path>    Output file path (required)
  --help             Show this message

Examples:
  npx ts-node scripts/cli.ts --profile bloom --output ./output/bloom.json
  npx ts-node scripts/cli.ts --config ./my-config.json --output ./output/custom.json
  npm run generate -- --profile bloom --output ./bloom.json
`);
}

/**
 * Builds a default {@link GeneratorInput} for a built-in profile slug.
 *
 * @param profileName - Key in {@link PROFILES}, e.g. `"bloom"`.
 */
function buildProfileInput(profileName: string): GeneratorInput {
  const base = PROFILES[profileName];
  if (!base) {
    throw new Error(
      `Unknown profile "${profileName}". Valid profiles: ${VALID_PROFILES.join(", ")}`,
    );
  }

  const { catalog, collections } = getScenarioCatalog(profileName);

  return {
    global: {
      period_start: "2025-06-01",
      period_end: "2026-02-28",
      seed: 42,
    },
    base,
    segments: [],
    spikes: STANDARD_FESTIVAL_SPIKES,
    catalog,
    collections,
  };
}

/**
 * Reads and parses a config file as {@link GeneratorInput}.
 *
 * @param configPath - Path to a JSON file.
 */
function loadConfigInput(configPath: string): GeneratorInput {
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
  if (!Array.isArray(input.spikes) || !Array.isArray(input.catalog)) {
    throw new Error(
      `Config must include spikes[] and catalog[]: ${resolved}`,
    );
  }
  if (!Array.isArray(input.collections)) {
    throw new Error(`Config must include collections[]: ${resolved}`);
  }

  return input;
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

  const hasProfile = flags.profile !== undefined;
  const hasConfig = flags.config !== undefined;

  if (hasProfile && hasConfig) {
    console.error("Error: use either --profile or --config, not both.");
    process.exit(1);
  }

  if (!hasProfile && !hasConfig) {
    console.error(
      "Error: provide --profile <name> or --config <path> to define the run.",
    );
    printUsage();
    process.exit(1);
  }

  const input = hasProfile
    ? buildProfileInput(flags.profile)
    : loadConfigInput(flags.config);

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
