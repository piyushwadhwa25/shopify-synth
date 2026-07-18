"use client";

const SECTIONS = [
  { id: "period", number: "01", label: "Generation period" },
  { id: "catalog", number: "02", label: "Product catalog" },
  { id: "parameters", number: "03", label: "Parameters" },
  { id: "overrides", number: "04", label: "Timeline overrides" },
  { id: "generate", number: "05", label: "Generate" },
  { id: "results", number: "06", label: "Results" },
] as const;

/**
 * Sticky side rail of in-page anchors for the six main setup sections.
 */
export function SectionNav() {
  return (
    <ul className="list-none space-y-0 p-0">
      {SECTIONS.map(({ id, number, label }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className="flex items-baseline gap-2 border-l-2 border-transparent py-2 pl-3 font-sans text-sm text-ink-muted transition-colors hover:border-signal hover:text-signal"
          >
            <span className="font-mono text-xs">{number}</span>
            <span>{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
