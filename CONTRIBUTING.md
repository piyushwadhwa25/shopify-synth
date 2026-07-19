# Contributing

Thanks for considering it. This is a small, actively-used tool rather than a large project, so the process is intentionally light.

## Local setup

```bash
git clone https://github.com/<your-username>/shopify-synth.git
cd shopify-synth
npm install
npm run dev
```

Open `http://localhost:3000`.

## What's useful to contribute

- **New scenario presets.** Presets are pure behavior, thirteen parameter values plus an optional trend curve, with no product data attached. If you've calibrated one against a real pattern you've seen (a specific vertical, a specific market), that's a good candidate. Add it under `src/lib/core/profiles/` following the shape of an existing preset, and give it a one-line behavioral description, no brand names.
- **Bug reports with a seed.** Since generation is deterministic, a bug report that includes the seed, catalog, date range, and parameters used is reproducible by anyone, which makes it far faster to fix. Please include those four things if you can.
- **Export format fixes.** If you're feeding generated data into a real analytics tool and find a field that doesn't match what Shopify actually sends, that's a genuinely useful and easy-to-verify fix, please include a link to the relevant Shopify API or CSV export documentation in the PR.

## What's likely out of scope

- Server-side generation. Everything currently runs client-side by design, see `docs/DECISIONS.md` if you're curious why.
- Non-Shopify platforms. The India-specific calibration and the export format are both intentionally Shopify-specific.

## Code style

- TypeScript throughout, `npx tsc --noEmit` should pass before opening a PR.
- Tailwind for styling, no separate CSS files for components.
- If you're touching generation logic (`src/lib/core/generate.ts`), please regenerate a dataset and sanity-check the Expected vs Actual comparison table before submitting, that table exists specifically to catch this class of regression.

## Reporting issues

Open a GitHub issue. Include a seed and parameter set if the issue is about generated output, that's the fastest way to get it looked at.
