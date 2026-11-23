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
  default: { iconBg: "bg-[#EAE9E4]", iconColor: "text-[#222321]" },
  accent: { iconBg: "bg-[#FFF0E9]", iconColor: "text-[#F26943]" },
  success: { iconBg: "bg-[#EAF6F1]", iconColor: "text-[#288568]" },
  warning: { iconBg: "bg-[#FDF6E7]", iconColor: "text-[#D69A35]" },
  danger: { iconBg: "bg-[#FDEDEC]", iconColor: "text-[#D9534F]" },
  info: { iconBg: "bg-[#EDF4FA]", iconColor: "text-[#4D83B5]" },
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
        "rounded-2xl border border-[#E6E5E0] bg-white p-5 shadow-card transition-all duration-150 hover:border-[#D6D4CC]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-[#72736E] truncate">{title}</p>
          <p className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-[#222321] font-display">
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
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#72736E]">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {trend && (
            <span className="shrink-0 font-medium text-[#288568]">{trend}</span>
          )}
        </div>
      )}
    </div>
  );
}
