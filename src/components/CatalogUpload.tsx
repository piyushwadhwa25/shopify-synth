"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { CatalogProduct } from "../lib/core/generate";
import { parseProductCSV } from "../lib/parser/product-csv";
import { InfoTooltip } from "./InfoTooltip";

/**
 * Props for {@link CatalogUpload}.
 */
export interface CatalogUploadProps {
  /**
   * Called after a successful parse with the catalog, or with `null` when
   * cleared (generation requires a catalog again after clear).
   */
  onCatalogParsed: (
    catalog: CatalogProduct[] | null,
    warnings: string[],
  ) => void;
}

/**
 * Derives a store id from an uploaded file name: lowercase, strip extension,
 * replace non-alphanumeric runs with `-`. Empty results become `"custom-store"`.
 */
function storeIdFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = withoutExt
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "custom-store";
}

/**
 * Required Shopify product-export CSV upload. Parsed catalog is passed to
 * the parent for generation; Clear clears the catalog until a new file is chosen.
 */
export function CatalogUpload({ onCatalogParsed }: CatalogUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [variantCount, setVariantCount] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const storeId = storeIdFromFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseProductCSV(text, storeId);
      const variants = result.catalog.reduce(
        (sum, product) => sum + product.variants.length,
        0,
      );

      setFileName(file.name);
      setProductCount(result.catalog.length);
      setVariantCount(variants);
      setWarnings(result.warnings);
      onCatalogParsed(
        result.catalog.length > 0 ? result.catalog : null,
        result.warnings,
      );
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileName(null);
    setProductCount(null);
    setVariantCount(null);
    setWarnings([]);
    onCatalogParsed(null, []);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-1">
        <p className="font-sans text-xs text-ink-muted">
          Upload a Shopify product export CSV. This is required: generated
          orders need real SKUs and product IDs to reference.
        </p>
        <InfoTooltip description="Must be a standard Shopify product export CSV (Products > Export, default template). Required columns: Handle, Title, Type, Option1 Value, Option2 Value, Variant SKU, Variant Price, Variant Inventory Qty. Rows are grouped by Handle, with one row per variant." />
      </div>
      <a
        href="/sample-catalog.csv"
        download
        className="inline-block font-sans text-sm text-signal underline transition-colors hover:text-ink"
      >
        Download sample CSV
      </a>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full max-w-md font-sans text-sm text-ink file:mr-3 file:rounded-sm file:border-0 file:bg-signal-soft file:px-3 file:py-1.5 file:font-medium file:text-signal hover:file:opacity-90"
        />

        {fileName !== null && (
          <button
            type="button"
            onClick={handleClear}
            className="font-sans text-sm text-signal underline transition-colors hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {productCount !== null && (
        <p className="font-sans text-xs text-ink-muted">
          {fileName ? `${fileName}: ` : ""}
          {productCount.toLocaleString()} products,{" "}
          {(variantCount ?? 0).toLocaleString()} variants
          {productCount === 0 ? " — no usable variant rows found" : ""}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 font-sans text-xs text-amber">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
