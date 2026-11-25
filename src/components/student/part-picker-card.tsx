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
      className={`part-card-perf group flex flex-col justify-between overflow-hidden rounded-[22px] border bg-white transition-[border-color,box-shadow] duration-200 ${
        isSelected
          ? "border-black ring-2 ring-[#C4F041] shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
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
            <span className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black">
              <Check className="h-4 w-4 stroke-[2.5]" />
            </span>
          )}
        </div>

        <div className="px-4 pt-4 pb-3 space-y-1.5">
          <p className="text-[13px] font-medium text-black/50 truncate">
            {row.item.category.name}
            {meta.labBlock ? ` · ${meta.labBlock}` : ""}
          </p>

          <h3 className="text-[16px] font-medium tracking-[-0.02em] text-black leading-snug line-clamp-2 min-h-[2.75rem]">
            {row.item.name}
          </h3>

          <p className="text-[14px] text-black/60 tabular-nums">
            {outOfStock
              ? "Currently out of stock"
              : `${row.availableQuantity} ${row.item.unit} available`}
          </p>
        </div>
      </div>

      {/* Quantity Selection Row */}
      <div className="px-4 pb-4 pt-1">
        {outOfStock ? (
          <p className="py-2 text-center text-[14px] font-medium text-black/40">
            Unavailable
          </p>
        ) : !isSelected ? (
          <button
            type="button"
            onClick={() => onUpdateQty(row, 1)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/16 bg-[#F0F0F0] text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] hover:border-black/25 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {selectLabel}
          </button>
        ) : (
          <div className="flex h-11 items-center justify-between rounded-full border border-black bg-black px-1.5 text-white">
            <button
              type="button"
              onClick={() => onUpdateQty(row, qty - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 text-[14px] tabular-nums">
              <input
                type="number"
                min={1}
                max={row.availableQuantity}
                value={qty}
                onChange={(e) => onUpdateQty(row, Number(e.target.value) || 1)}
                aria-label={`Quantity for ${row.item.name}`}
                className="w-12 bg-transparent text-center font-semibold text-[#C4F041] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-white/60">of {row.availableQuantity}</span>
            </div>

            <button
              type="button"
              onClick={() => onUpdateQty(row, qty + 1)}
              disabled={qty >= row.availableQuantity}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C4F041] text-black transition-opacity hover:opacity-90 disabled:opacity-35 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
