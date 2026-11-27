"use client";

import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { getPartImageUrl } from "@/lib/part-images";
import { extractItemProcurementMeta } from "@/lib/procurement-catalog";
import type { CampusInventoryDTO } from "@/types/contracts";

/** Smooth WebP image with GPU-accelerated shimmer loader and fade-in */
export const ShimmerPartImage = React.memo(function ShimmerPartImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (
      imgRef.current &&
      imgRef.current.complete &&
      imgRef.current.naturalWidth > 0
    ) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F2F2EE]">
      {!loaded && (
        <div className="lp-shimmer absolute inset-0" aria-hidden="true" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});

/** Soft Framed Gallery part card — inset photo cushion, diffuse elevation, floating lime stepper */
export const PartPickerCard = React.memo(function PartPickerCard({
  row,
  qty,
  selectLabel = "Add",
  onToggle,
  onUpdateQty,
}: {
  row: CampusInventoryDTO;
  qty: number;
  selectLabel?: string;
  onToggle: (row: CampusInventoryDTO) => void;
  onUpdateQty: (row: CampusInventoryDTO, nextVal: number) => void;
}) {
  const isSelected = qty > 0;
  const outOfStock = row.availableQuantity <= 0;
  const meta = extractItemProcurementMeta(row.item.specifications);
  const imgSrc =
    row.item.imageUrl || getPartImageUrl(row.item.code, row.item.category.slug);

  // Keep pill label crisp and compact inside the bottom-right footer row
  const compactLabel =
    selectLabel === "Add to Request" || selectLabel === "Select"
      ? "Add"
      : selectLabel;

  return (
    <article
      className={`part-card-perf group flex min-w-0 flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-2 pb-3 sm:p-2.5 sm:pb-3.5 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isSelected
          ? "ring-2 ring-[#C4F041] shadow-[0_12px_30px_rgba(0,0,0,0.065)]"
          : "ring-1 ring-black/[0.04] shadow-[0_8px_28px_rgba(0,0,0,0.045),0_1px_2px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]"
      } ${outOfStock ? "opacity-55" : ""}`}
    >
      {/* Clickable Inset Photo Cushion + Clean Editorial Copy */}
      <div
        role="button"
        tabIndex={outOfStock ? -1 : 0}
        onClick={() => onToggle(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(row);
          }
        }}
        className={outOfStock ? "cursor-not-allowed" : "cursor-pointer"}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] sm:rounded-[20px] bg-[#F5F5F2]">
          <ShimmerPartImage src={imgSrc} alt={row.item.name} />
        </div>

        <div className="px-1.5 pt-2.5 sm:px-2 sm:pt-3 space-y-1">
          <p className="text-[11.5px] sm:text-[12.5px] font-medium text-[#777771] truncate">
            {row.item.category.name}
            {meta.labBlock ? ` · ${meta.labBlock}` : ""}
          </p>

          <h3 className="text-[14px] sm:text-[15.5px] font-medium tracking-[-0.018em] text-[#141413] leading-[1.3] line-clamp-2 min-h-[2.3rem] sm:min-h-[2.55rem]">
            {row.item.name}
          </h3>
        </div>
      </div>

      {/* Soft Inline Stock + Floating Pill Action Footer */}
      <div className="mt-2.5 sm:mt-3 flex items-center justify-between gap-2 px-1.5 sm:px-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] sm:text-[13px] text-[#6B6B66] tabular-nums">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              outOfStock ? "bg-black/25" : "bg-[#7BB628]"
            }`}
            aria-hidden="true"
          />
          <span className="truncate">
            {outOfStock ? "Out of stock" : `${row.availableQuantity} left`}
          </span>
        </span>

        {outOfStock ? (
          <span className="text-[12px] sm:text-[13px] font-medium text-black/35">
            Unavailable
          </span>
        ) : !isSelected ? (
          <button
            type="button"
            onClick={() => onUpdateQty(row, 1)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full bg-[#F3F3EF] px-3 sm:px-3.5 text-[12.5px] sm:text-[13px] font-semibold text-[#141413] transition-colors duration-200 hover:bg-[#C4F041] active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.2] shrink-0" />
            <span>{compactLabel}</span>
          </button>
        ) : (
          <div className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-[#C4F041] px-1 text-[#111111]">
            <button
              type="button"
              onClick={() => onUpdateQty(row, qty - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-black transition-colors hover:bg-black/10 active:bg-black/15 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5 stroke-[2.4]" />
            </button>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={row.availableQuantity}
              value={qty}
              onChange={(e) => onUpdateQty(row, Number(e.target.value) || 1)}
              aria-label={`Quantity for ${row.item.name}`}
              className="w-6 sm:w-7 bg-transparent text-center text-[13px] font-semibold text-black tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            <button
              type="button"
              onClick={() => onUpdateQty(row, qty + 1)}
              disabled={qty >= row.availableQuantity}
              className="flex h-7 w-7 items-center justify-center rounded-full text-black transition-colors hover:bg-black/10 active:bg-black/15 disabled:opacity-35 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.4]" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
