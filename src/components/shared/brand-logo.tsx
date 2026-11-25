import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F26943] text-white shadow-xs">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M9 3H15M10 3V8.4L5.2 16.4C4.4 17.7 5.3 19.5 6.9 19.5H17.1C18.7 19.5 19.6 17.7 18.8 16.4L14 8.4V3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 14.5H16.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="11" cy="17" r="1" fill="currentColor" />
          <circle cx="14.2" cy="16.5" r="0.9" fill="currentColor" />
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-[1.05rem] font-bold tracking-tight text-[#222321] font-display">
            Campus<span className="text-[#F26943]">Lab</span>
          </span>
          <span className="text-[10px] font-medium tracking-wide uppercase text-[#72736E] mt-0.5">
            40-Campus Network
          </span>
        </div>
      )}
    </div>
  );
}
