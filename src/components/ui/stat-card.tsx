import React from "react";
import { cn, formatNumber } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "info";
  trend?: string;
  className?: string;
}

const TONE_STYLES: Record<
  NonNullable<StatCardProps["tone"]>,
  { iconBg: string; iconColor: string }
> = {
  default: { iconBg: "bg-[#EAEAE6]", iconColor: "text-black" },
  accent: { iconBg: "bg-[#C4F041]", iconColor: "text-black" },
  success: { iconBg: "bg-[#AAC2AA]", iconColor: "text-black" },
  warning: { iconBg: "bg-[#F3BD77]", iconColor: "text-black" },
  danger: { iconBg: "bg-[#FA8E66]", iconColor: "text-black" },
  info: { iconBg: "bg-[#BCE6FA]", iconColor: "text-black" },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  trend,
  className,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      className={cn(
        "rounded-[22px] border border-black/12 bg-white p-5 shadow-card transition-colors duration-150 hover:border-black/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-black/50 truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-[1.85rem] font-semibold tracking-[-0.03em] text-black font-display tabular-nums">
            {displayValue}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            styles.iconBg,
            styles.iconColor
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/8 pt-2.5 text-xs text-black/55">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {trend && (
            <span className="shrink-0 font-semibold text-black">{trend}</span>
          )}
        </div>
      )}
    </div>
  );
}
