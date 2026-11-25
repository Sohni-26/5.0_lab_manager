"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DottedGridCanvasProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Interactive finite dotted-grid canvas surface.
 * Responds smoothly wherever you hover across the canvas with an illuminated
 * dot-matrix spotlight and subtle spatial depth (never static or flat).
 */
export function DottedGridCanvas({
  className,
  children,
}: DottedGridCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor((prev) => ({ ...prev, active: false }));
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative w-full min-h-[calc(100vh-8.5rem)] rounded-[28px] border border-black/14 shadow-card overflow-hidden",
        className
      )}
      style={{
        backgroundColor: "#F2F2EF",
        backgroundImage:
          "radial-gradient(rgba(0, 0, 0, 0.15) 1.15px, transparent 1.15px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* Interactive hover-anywhere dot illumination layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: cursor.active ? 1 : 0,
          backgroundImage:
            "radial-gradient(rgba(0, 0, 0, 0.44) 1.45px, transparent 1.45px)",
          backgroundSize: "20px 20px",
          maskImage: `radial-gradient(210px circle at ${cursor.x}px ${cursor.y}px, black 0%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(210px circle at ${cursor.x}px ${cursor.y}px, black 0%, transparent 100%)`,
        }}
      />

      {/* Subtle ambient lime-warmth halo following the pointer across the finite canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: cursor.active ? 1 : 0,
          background: `radial-gradient(320px circle at ${cursor.x}px ${cursor.y}px, rgba(196, 240, 65, 0.12), transparent 72%)`,
        }}
      />

      {/* Canvas Foreground Content */}
      <div className="relative z-10 flex flex-1 flex-col w-full h-full">
        {children}
      </div>
    </div>
  );
}
