"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Props for {@link InfoTooltip}. */
export interface InfoTooltipProps {
  /** Main explanation shown in the popover. */
  description: string;
  /** Optional range hint, e.g. `"0 to 1"`. */
  range?: string;
}

/** Inline info-circle icon (Tabler ti-info-circle equivalent). */
function InfoCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/**
 * Click-to-toggle info popover for field labels. Closes on outside click,
 * Escape, or a second click on the icon.
 */
export function InfoTooltip({ description, range }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <InfoCircleIcon />
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[260px] rounded-md border border-zinc-200 bg-white p-3 text-left shadow-md"
        >
          <p className="text-xs leading-relaxed text-zinc-700">
            {description}
          </p>
          {range !== undefined && (
            <p className="mt-1.5 text-xs text-zinc-500">Range: {range}</p>
          )}
        </div>
      )}
    </div>
  );
}
