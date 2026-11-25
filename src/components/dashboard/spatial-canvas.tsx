"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface DottedGridCanvasProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Pure finite dotted-grid canvas surface.
 */
export function DottedGridCanvas({
  className,
  children,
}: DottedGridCanvasProps) {
  return (
    <div
      className={cn(
        "relative w-full min-h-[calc(100vh-8.5rem)] rounded-[28px] border border-black/14 shadow-card overflow-hidden",
        className
      )}
      style={{
        backgroundColor: "#F2F2EF",
        backgroundImage:
          "radial-gradient(rgba(0, 0, 0, 0.16) 1.15px, transparent 1.15px)",
        backgroundSize: "20px 20px",
      }}
    >
      {children}
    </div>
  );
}
