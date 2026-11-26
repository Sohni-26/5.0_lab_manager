"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
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
    <div className="relative h-full w-full overflow-hidden bg-[#E6E6E2]">
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
        className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-[1.04] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});

/** Clean editorial part card — zero tiny tags, DM Sans typography, inline quantity stepper */
export const PartPickerCard = React.memo(function PartPickerCard({
  row,
  qty,
  selectLabel = "Select",
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

  return (
    <article
      className={`part-card-perf group flex min-w-0 flex-col justify-between overflow-hidden rounded-[18px] sm:rounded-[22px] border bg-white transition-[border-color,box-shadow] duration-200 ${
        isSelected
          ? "border-black ring-2 ring-[#C4F041] shadow-[0_8px_22px_rgba(0,0,0,0.08)] sm:shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
          : "border-black/14 hover:border-black/35"
      } ${outOfStock ? "opacity-55" : ""}`}
    >
      {/* Clickable Photo + Clean Editorial Copy */}
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
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-black/10">
          <ShimmerPartImage src={imgSrc} alt={row.item.name} />
          {isSelected && (
            <span className="absolute right-2 top-2 sm:right-3 sm:top-3 z-10 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black shadow-xs">
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
            </span>
          )}
        </div>

        <div className="px-2.5 pt-2.5 pb-2 space-y-1 sm:px-4 sm:pt-4 sm:pb-3 sm:space-y-1.5">
          <p className="text-[11px] sm:text-[13px] font-medium text-black/50 truncate">
            {row.item.category.name}
            {meta.labBlock ? ` · ${meta.labBlock}` : ""}
          </p>

          <h3 className="text-[14px] sm:text-[16px] font-medium tracking-[-0.02em] text-black leading-[1.3] sm:leading-snug line-clamp-2 min-h-[2.3rem] sm:min-h-[2.75rem]">
            {row.item.name}
          </h3>

          <p className="text-[12px] sm:text-[14px] text-black/60 tabular-nums truncate">
            {outOfStock
              ? "Currently out of stock"
              : `${row.availableQuantity} ${row.item.unit} available`}
          </p>
        </div>
      </div>

      {/* Quantity Selection Row */}
      <div className="px-2.5 pb-2.5 pt-1 sm:px-4 sm:pb-4 sm:pt-1">
        {outOfStock ? (
          <p className="py-2 text-center text-[12px] sm:text-[14px] font-medium text-black/40">
            Unavailable
          </p>
        ) : !isSelected ? (
          <button
            type="button"
            onClick={() => onUpdateQty(row, 1)}
            className="flex h-10 sm:h-11 w-full items-center justify-center gap-1 sm:gap-2 rounded-full border border-black/16 bg-[#F0F0F0] px-2 sm:px-3 text-[12.5px] sm:text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] hover:border-black/25 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{selectLabel}</span>
          </button>
        ) : (
          <div className="flex h-10 sm:h-11 w-full items-center justify-between rounded-full border border-black bg-black px-1 sm:px-1.5 text-white">
            <button
              type="button"
              onClick={() => onUpdateQty(row, qty - 1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 active:bg-white/30 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>

            <div className="flex min-w-0 items-center justify-center gap-0.5 sm:gap-1.5 text-[13px] sm:text-[14px] tabular-nums">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={row.availableQuantity}
                value={qty}
                onChange={(e) => onUpdateQty(row, Number(e.target.value) || 1)}
                aria-label={`Quantity for ${row.item.name}`}
                className="w-7 sm:w-12 bg-transparent text-center font-semibold text-[#C4F041] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-white/55 sm:hidden">
                /{row.availableQuantity}
              </span>
              <span className="hidden text-white/60 sm:inline">
                of {row.availableQuantity}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onUpdateQty(row, qty + 1)}
              disabled={qty >= row.availableQuantity}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C4F041] text-black transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-35 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
