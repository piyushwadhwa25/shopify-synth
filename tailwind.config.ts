import type { Config } from "tailwindcss";

/**
 * Design-system theme extensions for shopify-synth.
 * Token values live in `src/app/globals.css` (:root); this maps them into Tailwind.
 */
const config: Config = {
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        line: "var(--line)",
        signal: "var(--signal)",
        "signal-soft": "var(--signal-soft)",
        amber: "var(--amber)",
        success: "var(--success)",
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
};

export default config;
