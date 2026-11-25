"use client";

import React from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileDotTone = "healthy" | "alert" | "transit" | "pending" | "inactive";

export const DOT_TONE_STYLES: Record<
  TileDotTone,
  { dot: string; ring: string; label: string; badge: string }
> = {
  healthy: {
    dot: "bg-[#1F8A3B]",
    ring: "ring-[#1F8A3B]/20",
    label: "Healthy / Ready",
    badge: "bg-[#DCEFD9] text-[#14532D] border-[#9EC699]/70",
  },
  alert: {
    dot: "bg-[#E11D2E]",
    ring: "ring-[#E11D2E]/25",
    label: "Ticket / Shortage",
    badge: "bg-[#FCE4DF] text-[#991B1B] border-[#E8A598]/70",
  },
  transit: {
    dot: "bg-[#0284C7]",
    ring: "ring-[#0284C7]/25",
    label: "Delivery Active",
    badge: "bg-[#E3F3FC] text-[#075985] border-[#9EC3D5]/80",
  },
  pending: {
    dot: "bg-[#D97706]",
    ring: "ring-[#D97706]/25",
    label: "Action Pending",
    badge: "bg-[#FDF0D8] text-[#92400E] border-[#E5C185]/80",
  },
  inactive: {
    dot: "bg-black/30",
    ring: "ring-black/10",
    label: "Inactive / Hidden",
    badge: "bg-[#EAEAE6] text-black/60 border-black/12",
  },
};

export type LaneTone = "danger" | "warning" | "transit" | "success" | "neutral";

const LANE_TONE_STYLES: Record<LaneTone, string> = {
  danger: "bg-[#FCE4DF]/95 border-[#E8A598]/70",
  warning: "bg-[#FDF0D8]/95 border-[#E5C185]/70",
  transit: "bg-[#E3F3FC]/95 border-[#9EC3D5]/75",
  success: "bg-[#DCEFD9]/95 border-[#9EC699]/75",
  neutral: "bg-[#EFEFED]/95 border-black/12",
};

interface SpatialCanvasProps {
  title: string;
  subtitle?: string;
  activeViewLabel?: string | null;
  onBack?: () => void;
  liveFlash?: boolean;
  lastEventText?: string | null;
  legend?: Array<{ tone: TileDotTone; label: string; count?: number }>;
  toolbar?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Finite dotted-grid interactive canvas container (Figma-inspired light editorial board).
 * Hosts both the overview tile grid and the inbuilt action view that activates on interaction.
 */
export function SpatialCanvas({
  title,
  subtitle,
  activeViewLabel,
  onBack,
  liveFlash = false,
  lastEventText,
  legend,
  toolbar,
  headerActions,
  children,
}: SpatialCanvasProps) {
  return (
    <div className="space-y-4">
      {/* Compact Top Control Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-[26px] font-semibold tracking-[-0.03em] text-black">
              {title}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-black/12 px-2.5 py-0.5 text-[11px] font-semibold text-black transition-colors",
                liveFlash ? "bg-[#C4F041]" : "bg-white"
              )}
            >
              <Radio
                className={cn(
                  "h-3 w-3",
                  liveFlash ? "animate-ping text-black" : "text-[#1F8A3B]"
                )}
              />
              {liveFlash ? "Live Update" : "Live Board"}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-black/55 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {headerActions && (
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        )}
      </div>

      {/* Finite Dotted-Grid Canvas Board */}
      <section className="rounded-[28px] border border-black/14 bg-white shadow-card overflow-hidden">
        {/* Canvas Chrome Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeViewLabel && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-[#F5F5F3] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Grid
              </button>
            ) : null}

            <div className="flex items-center gap-1.5 text-xs font-medium text-black/50 truncate">
              <span
                className={cn(
                  activeViewLabel ? "cursor-pointer hover:text-black" : "text-black font-semibold"
                )}
                onClick={activeViewLabel && onBack ? onBack : undefined}
              >
                Canvas Grid
              </span>
              {activeViewLabel && (
                <>
                  <span>/</span>
                  <span className="font-semibold text-black truncate">
                    {activeViewLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lastEventText && (
              <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#C4F041]/35 px-2.5 py-1 text-[11px] font-medium text-black max-w-[300px] truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                {lastEventText}
              </span>
            )}

            {legend && legend.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-black/65">
                {legend.map((entry) => (
                  <span key={entry.label} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        DOT_TONE_STYLES[entry.tone].dot
                      )}
                    />
                    <span>{entry.label}</span>
                    {entry.count !== undefined && (
                      <strong className="font-semibold text-black tabular-nums">
                        ({entry.count})
                      </strong>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Optional Filter / Action Bar */}
        {toolbar && (
          <div className="border-b border-black/10 bg-[#FAFAF8] px-4 sm:px-5 py-2.5">
            {toolbar}
          </div>
        )}

        {/* Finite Dotted-Grid Surface */}
        <div
          className="relative min-h-[540px] max-h-[74vh] overflow-y-auto p-5 sm:p-7"
          style={{
            backgroundColor: "#F2F2EF",
            backgroundImage:
              "radial-gradient(rgba(0, 0, 0, 0.16) 1.15px, transparent 1.15px)",
            backgroundSize: "20px 20px",
          }}
        >
          {children}
        </div>
      </section>
    </div>
  );
}

interface GridTileProps {
  code: string;
  label: string;
  sublabel?: string;
  tone: TileDotTone;
  pulse?: boolean;
  selected?: boolean;
  badges?: Array<{ text: string; tone?: TileDotTone }>;
  onClick: () => void;
}

/**
 * Compact white status tile with live colored dot (inspired by Figma Frame 1).
 */
export function GridTile({
  code,
  label,
  sublabel,
  tone,
  pulse = false,
  selected = false,
  badges,
  onClick,
}: GridTileProps) {
  const toneStyle = DOT_TONE_STYLES[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-between rounded-[20px] border bg-white px-3.5 py-4 text-center transition-all duration-150 cursor-pointer",
        "shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-black/40 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]",
        selected
          ? "border-black ring-2 ring-[#C4F041]"
          : "border-black/10"
      )}
    >
      {/* Live Status Dot */}
      <div className="relative flex items-center justify-center mb-2.5">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-5 w-5 rounded-full opacity-35 animate-ping",
              toneStyle.dot
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-3.5 w-3.5 rounded-full ring-4",
            toneStyle.dot,
            toneStyle.ring
          )}
        />
      </div>

      {/* Primary Code */}
      <span className="font-mono text-sm font-bold tracking-tight text-black tabular-nums">
        {code}
      </span>

      {/* Label */}
      <span className="mt-0.5 text-xs font-medium text-black/75 line-clamp-1 w-full">
        {label}
      </span>

      {sublabel && (
        <span className="mt-0.5 text-[10px] text-black/45 line-clamp-1 w-full tabular-nums">
          {sublabel}
        </span>
      )}

      {/* Optional compact micro-badges */}
      {badges && badges.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1">
          {badges.map((b, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tabular-nums leading-none",
                DOT_TONE_STYLES[b.tone ?? tone].badge
              )}
            >
              {b.text}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface ActionLaneCardProps {
  title: string;
  subtitle?: string;
  count?: number;
  tone: LaneTone;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Tall color-coded inbuilt action lane with crisp white top header card (inspired by Figma Frame 2).
 */
export function ActionLaneCard({
  title,
  subtitle,
  count,
  tone,
  headerAction,
  children,
}: ActionLaneCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[24px] border p-3.5 sm:p-4 min-h-[420px]",
        LANE_TONE_STYLES[tone]
      )}
    >
      {/* Crisp White Top Header Pill Card */}
      <div className="rounded-[16px] border border-black/10 bg-white px-4 py-3 shadow-[0_2px_6px_rgba(0,0,0,0.04)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-black truncate">
              {title}
            </h3>
            {count !== undefined && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F2F2EF] border border-black/10 px-1.5 text-[11px] font-bold text-black tabular-nums">
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-black/55 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Lane Interactive Body */}
      <div className="mt-3.5 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
        {children}
      </div>
    </div>
  );
}
