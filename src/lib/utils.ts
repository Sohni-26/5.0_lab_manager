import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { IssueCategory, PhotoAngle, TicketPriority } from "@/types/contracts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  if (Number.isNaN(diffMs)) return "—";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const PHOTO_ANGLE_META: Record<
  PhotoAngle,
  { label: string; shortLabel: string; hint: string }
> = {
  FRONT_TOP: {
    label: "Front / Top",
    shortLabel: "Front / Top",
    hint: "Capture main display, ports & top surface clearly",
  },
  BACK_BOTTOM: {
    label: "Back / Bottom",
    shortLabel: "Back / Bottom",
    hint: "Capture serial plate, underside & rear terminals",
  },
  LEFT_SIDE: {
    label: "Left Side",
    shortLabel: "Left Side",
    hint: "Capture left profile & casing condition",
  },
  RIGHT_SIDE: {
    label: "Right Side",
    shortLabel: "Right Side",
    hint: "Capture right profile & side connectors",
  },
};

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  DAMAGED_EQUIPMENT: "Damaged Equipment",
  MISSING_EQUIPMENT: "Missing Equipment",
  MALFUNCTIONING_EQUIPMENT: "Malfunctioning Equipment",
  INVENTORY_DISCREPANCY: "Inventory Discrepancy",
  INCORRECT_ALLOCATION: "Incorrect Allocation",
  MAINTENANCE_REQUEST: "Maintenance Request",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
