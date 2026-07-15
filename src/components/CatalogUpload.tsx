"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { CatalogProduct } from "../lib/core/generate";
import { parseProductCSV } from "../lib/parser/product-csv";

/**
 * Props for {@link CatalogUpload}.
 */
export interface CatalogUploadProps {
  /** Written to every parsed product's `store_id` (typically the profile store id). */
  storeId: string;
  /**
   * Called after a successful parse with the catalog, or with `null` when
   * cleared so the caller can fall back to the built-in scenario catalog.
   */
  onCatalogParsed: (
    catalog: CatalogProduct[] | null,
    warnings: string[],
  ) => void;
}

/**
 * Optional Shopify product-export CSV upload. When a file is parsed, the
 * parent should pass that catalog into generate; Clear reverts to default.
 */
export function CatalogUpload({
  storeId,
  onCatalogParsed,
}: CatalogUploadProps) {
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
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Product catalog (optional)
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Upload a Shopify product export CSV to generate orders against real
          SKUs. Skip this to use the built-in scenario catalog.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          disabled={!storeId}
          onChange={handleFileChange}
          className="block w-full max-w-md text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {fileName !== null && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Clear
          </button>
        )}
      </div>

      {!storeId && (
        <p className="text-sm text-zinc-500">
          Select a scenario first so uploaded products get a store id.
        </p>
      )}

      {productCount !== null && (
        <p className="text-sm text-zinc-700">
          {fileName ? `${fileName}: ` : ""}
          {productCount.toLocaleString()} products,{" "}
          {(variantCount ?? 0).toLocaleString()} variants
          {productCount === 0 ? " — no usable variant rows found" : ""}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
