import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export function BrandLogo({
  compact = false,
  inverse = false,
  className,
}: BrandLogoProps) {
  const src = inverse
    ? "/images/brand/nxtwave-logo-dark.webp"
    : "/images/brand/nxtwave-logo.webp";

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/12 bg-white p-1.5 select-none",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/brand/nxtwave-logo.webp"
          alt="NxtWave"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center select-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="NxtWave"
        className="h-8 w-auto object-contain"
      />
    </div>
  );
}
