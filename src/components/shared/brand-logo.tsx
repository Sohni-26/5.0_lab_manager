import React from "react";
import { cn } from "@/lib/utils";
import { LoopsiiMark } from "@/components/landing/primitives";

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#C4F041]">
        <LoopsiiMark className="h-[15px] w-auto" />
      </div>
      {!compact && (
        <span className="text-[1.08rem] font-bold uppercase tracking-[-0.04em] text-black leading-none font-display">
          CAMPUSLAB
        </span>
      )}
    </div>
  );
}
