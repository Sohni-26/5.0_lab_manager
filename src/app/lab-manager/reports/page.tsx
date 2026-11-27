"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Download,
  EyeOff,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  Radio,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import {
  loadDemoAllocations,
  loadDemoCampusInventory,
  loadDemoTickets,
} from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import { extractItemProcurementMeta } from "@/lib/procurement-catalog";
import { exportToCsv, formatDateTime, formatNumber } from "@/lib/utils";
import type {
  CampusInventoryDTO,
  IssueTicketDTO,
  RealtimeEventType,
  StockAllocationDTO,
} from "@/types/contracts";

// ============================================================================
// Constants & Palette (NxtWave Option A Executive Reports)
// ============================================================================

const HEALTH_COLORS = {
  available: "#C4F041",
  borrowed: "#111111",
  reserved: "#3B82F6",
  damaged: "#F59E0B",
  missing: "#EF4444",
} as const;

const REPORT_REALTIME_EVENTS = [
  "inventory.updated",
  "inventory.visibility_changed",
  "visibility.changed",
  "allocation.verified",
  "ticket.updated",
  "request.status_changed",
  "request.returned",
  "return.submitted",
  "return.verified",
  "borrowing.issued",
] as unknown as RealtimeEventType[];

type BreakdownMode = "LAB_BLOCK" | "CATEGORY";

type AttentionReason =
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "DAMAGED"
  | "MISSING"
  | "HIDDEN";

interface AttentionEntry {
  row: CampusInventoryDTO;
  labBlock: string;
  reasons: AttentionReason[];
  primaryReason: AttentionReason;
  severity: number;
}

const REASON_META: Record<
  AttentionReason,
  { label: string; bg: string; text: string; dot: string }
> = {
  MISSING: {
    label: "Missing Units",
    bg: "bg-[#EF4444]/12",
    text: "text-[#B91C1C]",
    dot: "bg-[#EF4444]",
  },
  DAMAGED: {
    label: "Damaged Units",
    bg: "bg-[#F59E0B]/15",
    text: "text-[#92400E]",
    dot: "bg-[#F59E0B]",
  },
  OUT_OF_STOCK: {
    label: "Out of Stock",
    bg: "bg-black",
    text: "text-white",
    dot: "bg-[#EF4444]",
  },
  LOW_STOCK: {
    label: "Low Stock",
    bg: "bg-[#C4F041]/35",
    text: "text-[#111111]",
    dot: "bg-[#111111]",
  },
  HIDDEN: {
    label: "Hidden",
    bg: "bg-[#F3F3F0]",
    text: "text-[#4B4B47]",
    dot: "bg-[#71716B]",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function getLabBlock(row: CampusInventoryDTO): string {
  const meta = extractItemProcurementMeta(row.item.specifications);
  if (meta.labBlock && meta.labBlock.trim()) return meta.labBlock.trim();
  const rawLab = row.item.specifications?.lab;
  if (typeof rawLab === "string" && rawLab.trim()) return rawLab.trim();
  return "General Lab";
}

function shortenLabel(label: string, maxLen = 14): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1).trimEnd()}…`;
}

function getRowTotalUnits(row: CampusInventoryDTO): number {
  const computed =
    row.availableQuantity +
    row.borrowedQuantity +
    row.reservedQuantity +
    row.damagedQuantity +
    row.missingQuantity;
  return Math.max(computed, row.receivedQuantity, 0);
}

// ============================================================================
// Custom Recharts Tooltips
// ============================================================================

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: {
      name: string;
      value: number;
      pct: number;
      color: string;
    };
  }>;
}

function DistributionTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-2xl bg-white px-4 py-3 text-[13px] text-[#111111] shadow-[0_12px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.08]">
      <div className="flex items-center gap-2 font-medium">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.name}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
        <span className="text-[16px] font-semibold text-black">
          {formatNumber(item.value)}
        </span>
        <span className="text-[#5E5E5A]">units ({item.pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

interface BarDatum {
  name: string;
  shortName: string;
  available: number;
  inCirculation: number;
  borrowed: number;
  reserved: number;
  damagedMissing: number;
  skuCount: number;
}

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: BarDatum;
  }>;
}

function BreakdownTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  const total = datum.available + datum.inCirculation + datum.damagedMissing;
  const utilPct = total > 0 ? Math.round((datum.inCirculation / total) * 100) : 0;

  return (
    <div className="min-w-[200px] rounded-2xl bg-white px-4 py-3 text-[13px] text-[#111111] shadow-[0_12px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.08]">
      <p className="font-semibold text-black">{datum.name}</p>
      <p className="mt-0.5 text-[#5E5E5A]">
        {datum.skuCount} SKU{datum.skuCount === 1 ? "" : "s"} · {utilPct}% active
        utilization
      </p>
      <div className="mt-2.5 space-y-1.5 border-t border-black/[0.06] pt-2 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[#4B4B47]">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15"
              style={{ backgroundColor: HEALTH_COLORS.available }}
            />
            Available
          </span>
          <span className="font-semibold text-black">
            {formatNumber(datum.available)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[#4B4B47]">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: HEALTH_COLORS.borrowed }}
            />
            Borrowed
          </span>
          <span className="font-semibold text-black">
            {formatNumber(datum.borrowed)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[#4B4B47]">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: HEALTH_COLORS.reserved }}
            />
            Reserved
          </span>
          <span className="font-semibold text-black">
            {formatNumber(datum.reserved)}
          </span>
        </div>
        {datum.damagedMissing > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-[#92400E]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: HEALTH_COLORS.damaged }}
              />
              Damaged / Missing
            </span>
            <span className="font-semibold text-[#B91C1C]">
              {formatNumber(datum.damagedMissing)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function LabManagerReportsPage() {
  const { user, isDemoMode } = useAuth();
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("LAB_BLOCK");
  const [watchlistFilter, setWatchlistFilter] = useState<"ALL" | AttentionReason>(
    "ALL"
  );
  const [showAllWatchlist, setShowAllWatchlist] = useState(false);

  const loadData = useCallback(async () => {
    if (isDemoMode) {
      setInventory(loadDemoCampusInventory());
      setAllocations(loadDemoAllocations());
      setTickets(loadDemoTickets());
      setLastSyncedAt(new Date().toISOString());
      setLoading(false);
      return;
    }

    try {
      const [invRes, allocRes, ticketRes] = await Promise.all([
        apiClient.inventory
          .list({ pageSize: 250 })
          .catch(() => ({ data: loadDemoCampusInventory() })),
        apiClient.allocations
          .list({ pageSize: 60 })
          .catch(() => ({ data: loadDemoAllocations() })),
        apiClient.tickets
          .list({ pageSize: 60 })
          .catch(() => ({ data: loadDemoTickets() })),
      ]);

      setInventory(invRes.data);
      setAllocations(allocRes.data);
      setTickets(ticketRes.data);
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { status: realtimeStatus } = useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: REPORT_REALTIME_EVENTS,
    onEvent: () => {
      setLivePulse(true);
      void loadData();
      window.setTimeout(() => setLivePulse(false), 1800);
    },
    onReconnect: () => {
      void loadData();
    },
  });

  // Campus display name
  const campusName = useMemo(() => {
    return (
      user?.campus?.name ||
      inventory[0]?.campus?.name ||
      "Bengaluru North Campus"
    );
  }, [user?.campus?.name, inventory]);

  // Core stock aggregations
  const metrics = useMemo(() => {
    let available = 0;
    let borrowed = 0;
    let reserved = 0;
    let damaged = 0;
    let missing = 0;
    let visibleSkus = 0;
    let hiddenSkus = 0;

    for (const r of inventory) {
      available += r.availableQuantity;
      borrowed += r.borrowedQuantity;
      reserved += r.reservedQuantity;
      damaged += r.damagedQuantity;
      missing += r.missingQuantity;
      if (r.isVisible) visibleSkus += 1;
      else hiddenSkus += 1;
    }

    const inCirculation = borrowed + reserved;
    const damagedMissing = damaged + missing;
    const totalUnits = available + borrowed + reserved + damaged + missing;
    const utilizationPct =
      totalUnits > 0 ? (inCirculation / totalUnits) * 100 : 0;
    const availabilityPct = totalUnits > 0 ? (available / totalUnits) * 100 : 0;

    const openTickets = tickets.filter(
      (t) => t.status !== "RESOLVED" && t.status !== "CLOSED"
    ).length;

    const pendingDispatches = allocations.filter(
      (a) =>
        a.status === "DISPATCHED" ||
        a.status === "PARTIALLY_RECEIVED" ||
        a.status === "DISCREPANCY_REPORTED"
    ).length;

    return {
      available,
      borrowed,
      reserved,
      damaged,
      missing,
      inCirculation,
      damagedMissing,
      totalUnits,
      utilizationPct,
      availabilityPct,
      visibleSkus,
      hiddenSkus,
      totalSkus: inventory.length,
      openTickets,
      pendingDispatches,
    };
  }, [inventory, tickets, allocations]);

  // Donut / Pie distribution dataset
  const distributionSeries = useMemo(() => {
    const denom = metrics.totalUnits > 0 ? metrics.totalUnits : 1;
    return [
      {
        key: "available",
        name: "Available",
        value: metrics.available,
        pct: (metrics.available / denom) * 100,
        color: HEALTH_COLORS.available,
      },
      {
        key: "borrowed",
        name: "Borrowed",
        value: metrics.borrowed,
        pct: (metrics.borrowed / denom) * 100,
        color: HEALTH_COLORS.borrowed,
      },
      {
        key: "reserved",
        name: "Reserved",
        value: metrics.reserved,
        pct: (metrics.reserved / denom) * 100,
        color: HEALTH_COLORS.reserved,
      },
      {
        key: "damaged",
        name: "Damaged",
        value: metrics.damaged,
        pct: (metrics.damaged / denom) * 100,
        color: HEALTH_COLORS.damaged,
      },
      {
        key: "missing",
        name: "Missing",
        value: metrics.missing,
        pct: (metrics.missing / denom) * 100,
        color: HEALTH_COLORS.missing,
      },
    ];
  }, [metrics]);

  const nonZeroPieData = useMemo(
    () => distributionSeries.filter((d) => d.value > 0),
    [distributionSeries]
  );

  // Grouped Bar Chart dataset: By Lab Block or By Category
  const breakdownData = useMemo<BarDatum[]>(() => {
    const buckets = new Map<
      string,
      {
        name: string;
        available: number;
        borrowed: number;
        reserved: number;
        damagedMissing: number;
        skuCount: number;
      }
    >();

    for (const row of inventory) {
      const groupName =
        breakdownMode === "LAB_BLOCK"
          ? getLabBlock(row)
          : row.item.category?.name || "Uncategorized";

      const prev = buckets.get(groupName) ?? {
        name: groupName,
        available: 0,
        borrowed: 0,
        reserved: 0,
        damagedMissing: 0,
        skuCount: 0,
      };
      prev.available += row.availableQuantity;
      prev.borrowed += row.borrowedQuantity;
      prev.reserved += row.reservedQuantity;
      prev.damagedMissing += row.damagedQuantity + row.missingQuantity;
      prev.skuCount += 1;
      buckets.set(groupName, prev);
    }

    return Array.from(buckets.values())
      .map((b) => ({
        ...b,
        shortName: shortenLabel(b.name, 13),
        inCirculation: b.borrowed + b.reserved,
      }))
      .sort(
        (a, b) =>
          b.available + b.inCirculation - (a.available + a.inCirculation)
      )
      .slice(0, 7);
  }, [inventory, breakdownMode]);

  // Attention Watchlist (Low Stock, Out of Stock, Damaged, Missing, Hidden)
  const attentionList = useMemo<AttentionEntry[]>(() => {
    const entries: AttentionEntry[] = [];

    for (const row of inventory) {
      const reasons: AttentionReason[] = [];
      let severity = 0;

      if (row.missingQuantity > 0) {
        reasons.push("MISSING");
        severity += 50 + row.missingQuantity * 5;
      }
      if (row.damagedQuantity > 0) {
        reasons.push("DAMAGED");
        severity += 40 + row.damagedQuantity * 4;
      }
      if (row.availableQuantity === 0) {
        reasons.push("OUT_OF_STOCK");
        severity += 35;
      } else {
        const totalStock = Math.max(row.receivedQuantity, row.allocatedQuantity);
        const isLow =
          totalStock >= 3 &&
          (row.availableQuantity <= 2 ||
            row.availableQuantity / totalStock <= 0.3);
        if (isLow) {
          reasons.push("LOW_STOCK");
          severity += 20;
        }
      }
      if (!row.isVisible) {
        reasons.push("HIDDEN");
        severity += 10;
      }

      if (reasons.length > 0) {
        entries.push({
          row,
          labBlock: getLabBlock(row),
          reasons,
          primaryReason: reasons[0],
          severity,
        });
      }
    }

    return entries.sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return a.row.item.name.localeCompare(b.row.item.name);
    });
  }, [inventory]);

  const attentionCounts = useMemo(() => {
    const counts: Record<"ALL" | AttentionReason, number> = {
      ALL: attentionList.length,
      OUT_OF_STOCK: 0,
      LOW_STOCK: 0,
      DAMAGED: 0,
      MISSING: 0,
      HIDDEN: 0,
    };
    for (const entry of attentionList) {
      for (const reason of entry.reasons) {
        counts[reason] += 1;
      }
    }
    return counts;
  }, [attentionList]);

  const filteredAttention = useMemo(() => {
    if (watchlistFilter === "ALL") return attentionList;
    return attentionList.filter((e) => e.reasons.includes(watchlistFilter));
  }, [attentionList, watchlistFilter]);

  const displayedAttention = useMemo(() => {
    if (showAllWatchlist) return filteredAttention;
    return filteredAttention.slice(0, 8);
  }, [filteredAttention, showAllWatchlist]);

  // CSV Exports
  const handleExportInventoryCsv = () => {
    if (inventory.length === 0) {
      toast.info("No campus inventory records available to export.");
      return;
    }
    const dateStamp = new Date().toISOString().slice(0, 10);
    exportToCsv(
      `campus-inventory-health-${dateStamp}.csv`,
      inventory.map((r) => {
        const total = getRowTotalUnits(r);
        const inCirc = r.borrowedQuantity + r.reservedQuantity;
        return {
          Campus: r.campus?.name ?? campusName,
          Code: r.item.code,
          Name: r.item.name,
          Category: r.item.category?.name ?? "",
          LabBlock: getLabBlock(r),
          Visibility: r.isVisible ? "Visible" : "Hidden",
          Allocated: r.allocatedQuantity,
          Received: r.receivedQuantity,
          Available: r.availableQuantity,
          Borrowed: r.borrowedQuantity,
          Reserved: r.reservedQuantity,
          Damaged: r.damagedQuantity,
          Missing: r.missingQuantity,
          ActiveUtilizationPct:
            total > 0 ? Math.round((inCirc / total) * 100) : 0,
          LastUpdated: r.updatedAt,
        };
      })
    );
    toast.success(`Exported ${inventory.length} campus SKUs to CSV`);
  };

  const handleExportAttentionCsv = () => {
    if (attentionList.length === 0) {
      toast.info("All campus stock is healthy — no attention items to export.");
      return;
    }
    const dateStamp = new Date().toISOString().slice(0, 10);
    exportToCsv(
      `campus-attention-report-${dateStamp}.csv`,
      attentionList.map((entry) => ({
        Campus: entry.row.campus?.name ?? campusName,
        Code: entry.row.item.code,
        Name: entry.row.item.name,
        Category: entry.row.item.category?.name ?? "",
        LabBlock: entry.labBlock,
        AttentionReasons: entry.reasons
          .map((r) => REASON_META[r].label)
          .join("; "),
        Available: entry.row.availableQuantity,
        Borrowed: entry.row.borrowedQuantity,
        Reserved: entry.row.reservedQuantity,
        Damaged: entry.row.damagedQuantity,
        Missing: entry.row.missingQuantity,
        Visibility: entry.row.isVisible ? "Visible" : "Hidden",
        LastUpdated: entry.row.updatedAt,
      }))
    );
    toast.success(
      `Exported ${attentionList.length} attention report items to CSV`
    );
  };

  return (
    <div
      className="w-full min-w-0 overflow-x-hidden"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <DottedGridCanvas
        pannable={false}
        className="min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8"
      >
        <div className="mx-auto flex w-full max-w-[1380px] min-w-0 flex-col gap-5 sm:gap-6">
          {/* ================================================================
              Executive Header Card
          ================================================================ */}
          <section className="rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-7 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F3] px-3.5 py-1.5 text-[13px] font-medium text-[#111111] ring-1 ring-black/[0.06]">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        livePulse
                          ? "bg-[#C4F041] ring-4 ring-[#C4F041]/40"
                          : realtimeStatus === "reconnecting"
                            ? "bg-[#F59E0B]"
                            : "bg-[#22C55E]"
                      } transition-all`}
                    />
                    <span className="truncate">{campusName}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C4F041]/30 px-3 py-1.5 text-[13px] font-medium text-[#111111]">
                    <Radio className="h-3.5 w-3.5" />
                    <span>
                      {livePulse
                        ? "Stock synced just now"
                        : realtimeStatus === "demo"
                          ? "Live Local Sync"
                          : "Live Realtime"}
                    </span>
                  </span>
                </div>

                <div>
                  <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#111111]">
                    Campus Stock Health &amp; Reports
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
                    Executive utilization telemetry, lab-block availability
                    distribution, and actionable stock watchlists synced live
                    across your campus workbench.
                  </p>
                </div>

                {lastSyncedAt && (
                  <p className="text-[13px] text-[#71716B] tabular-nums">
                    {formatNumber(metrics.totalSkus)} SKUs ·{" "}
                    {formatNumber(metrics.totalUnits)} total units · Updated{" "}
                    {formatDateTime(lastSyncedAt)}
                  </p>
                )}
              </div>

              {/* Action Buttons (44px+ accessible touch targets) */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
                <button
                  type="button"
                  onClick={handleExportInventoryCsv}
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#C4F041] px-5 py-2.5 text-[14px] font-semibold text-[#111111] shadow-[0_6px_18px_rgba(196,240,65,0.35)] ring-1 ring-black/[0.08] transition-all hover:bg-[#b8e632] active:scale-[0.99] cursor-pointer"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Export Inventory CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAttentionCsv}
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-all hover:bg-black/85 active:scale-[0.99] cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#C4F041]" />
                  <span>Export Attention Report CSV</span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[13px] font-semibold tabular-nums text-[#C4F041]">
                    {attentionList.length}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* ================================================================
              4-Stat Campus Health Strip
          ================================================================ */}
          <section
            aria-label="Campus Stock Health Key Metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {/* 1. Active Utilization % */}
            <div className="flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#5E5E5A]">
                  Active Utilization
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-[#C4F041]">
                  <TrendingUp className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[32px] sm:text-[36px] font-semibold tracking-[-0.03em] leading-none text-[#111111]">
                    {loading ? "—" : `${metrics.utilizationPct.toFixed(1)}%`}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F1F1EE]">
                  <div
                    className="h-full rounded-full bg-[#111111] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, metrics.utilizationPct))}%`,
                    }}
                  />
                </div>
                <p className="mt-2.5 text-[13px] text-[#5E5E5A] tabular-nums">
                  {formatNumber(metrics.inCirculation)} of{" "}
                  {formatNumber(metrics.totalUnits)} campus units active
                </p>
              </div>
            </div>

            {/* 2. Available Units */}
            <div className="flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#5E5E5A]">
                  Available Units
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#C4F041] text-[#111111]">
                  <Box className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[32px] sm:text-[36px] font-semibold tracking-[-0.03em] leading-none text-[#111111]">
                    {loading ? "—" : formatNumber(metrics.available)}
                  </span>
                  <span className="text-[13px] font-medium text-[#5E5E5A]">
                    ready ({metrics.availabilityPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C4F041]/30 px-2.5 py-0.5 font-medium text-[#111111]">
                    {formatNumber(metrics.visibleSkus)} visible SKUs
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F3F0] px-2.5 py-0.5 font-medium text-[#5E5E5A]">
                    <EyeOff className="h-3.5 w-3.5" />
                    {formatNumber(metrics.hiddenSkus)} hidden
                  </span>
                </div>
              </div>
            </div>

            {/* 3. In Circulation */}
            <div className="flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#5E5E5A]">
                  In Circulation
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/12 text-[#2563EB]">
                  <Activity className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[32px] sm:text-[36px] font-semibold tracking-[-0.03em] leading-none text-[#111111]">
                    {loading ? "—" : formatNumber(metrics.inCirculation)}
                  </span>
                  <span className="text-[13px] font-medium text-[#5E5E5A]">
                    units out
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111111]/8 px-2.5 py-0.5 font-medium text-[#111111]">
                    <span className="h-2 w-2 rounded-full bg-[#111111]" />
                    {formatNumber(metrics.borrowed)} borrowed
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6]/12 px-2.5 py-0.5 font-medium text-[#1D4ED8]">
                    <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                    {formatNumber(metrics.reserved)} reserved
                  </span>
                </div>
                {metrics.pendingDispatches > 0 && (
                  <p className="mt-2 text-[13px] text-[#5E5E5A] tabular-nums">
                    + {metrics.pendingDispatches} incoming dispatch
                    {metrics.pendingDispatches === 1 ? "" : "es"} awaiting
                    receipt
                  </p>
                )}
              </div>
            </div>

            {/* 4. Damaged & Missing */}
            <div className="flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#5E5E5A]">
                  Damaged &amp; Missing
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#B45309]">
                  <ShieldAlert className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[32px] sm:text-[36px] font-semibold tracking-[-0.03em] leading-none text-[#111111]">
                    {loading ? "—" : formatNumber(metrics.damagedMissing)}
                  </span>
                  <span className="text-[13px] font-medium text-[#5E5E5A]">
                    flagged units
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B]/15 px-2.5 py-0.5 font-medium text-[#92400E]">
                    {formatNumber(metrics.damaged)} damaged
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/12 px-2.5 py-0.5 font-medium text-[#B91C1C]">
                    {formatNumber(metrics.missing)} missing
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-[#5E5E5A]">
                  <span className="tabular-nums">
                    {formatNumber(metrics.openTickets)} open issue ticket
                    {metrics.openTickets === 1 ? "" : "s"}
                  </span>
                  <Link
                    href="/lab-manager/tickets"
                    className="inline-flex items-center gap-1 font-medium text-[#111111] underline decoration-black/25 underline-offset-4 hover:decoration-black"
                  >
                    Tickets
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              Interactive Recharts Visualizations
          ================================================================ */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 1: Stock Health Distribution Donut */}
            <div className="flex min-w-0 flex-col rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-[#111111]">
                    Stock Health Distribution
                  </h2>
                  <p className="mt-1 text-[13.5px] text-[#5E5E5A]">
                    Live composition of every tracked campus unit by operational
                    status
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F5F5F3] px-3.5 py-1.5 text-[13px] font-medium text-[#111111] ring-1 ring-black/[0.05] tabular-nums">
                  {formatNumber(metrics.totalUnits)} units
                </span>
              </div>

              <div className="relative mt-5 h-[280px] w-full min-w-0 rounded-[20px] bg-[#FAFAF8] p-2 ring-1 ring-black/[0.04]">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-[14px] text-[#5E5E5A]">
                    Loading stock distribution…
                  </div>
                ) : nonZeroPieData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[14px] text-[#5E5E5A]">
                    No campus stock units recorded yet.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={nonZeroPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={106}
                          paddingAngle={3}
                          cornerRadius={6}
                          stroke="#FFFFFF"
                          strokeWidth={2.5}
                        >
                          {nonZeroPieData.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<DistributionTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center Donut Summary */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[26px] font-semibold tracking-[-0.03em] leading-none text-[#111111] tabular-nums">
                        {metrics.availabilityPct.toFixed(0)}%
                      </span>
                      <span className="mt-1 text-[13px] font-medium text-[#5E5E5A]">
                        Available
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Clean Custom Legend with exact unit counts & percentages */}
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {distributionSeries.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8F8F6] px-3.5 py-2.5 ring-1 ring-black/[0.04]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="truncate text-[14px] font-medium text-[#111111]">
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                      <span className="text-[14px] font-semibold text-[#111111]">
                        {formatNumber(entry.value)}
                      </span>
                      <span className="text-[13px] text-[#5E5E5A]">
                        {entry.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Stock by Lab Block / Category Bar Chart */}
            <div className="flex min-w-0 flex-col rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-[#111111]">
                    {breakdownMode === "LAB_BLOCK"
                      ? "Stock by Lab Block"
                      : "Stock by Category"}
                  </h2>
                  <p className="mt-1 text-[13.5px] text-[#5E5E5A]">
                    Comparing ready-to-issue units against active student
                    circulation
                  </p>
                </div>

                {/* Pill Toggle: By Lab Block | By Category */}
                <div
                  role="tablist"
                  aria-label="Chart breakdown mode"
                  className="inline-flex w-full sm:w-auto shrink-0 items-center rounded-full bg-[#F3F3F0] p-1 ring-1 ring-black/[0.05]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={breakdownMode === "LAB_BLOCK"}
                    onClick={() => setBreakdownMode("LAB_BLOCK")}
                    className={`min-h-[44px] flex-1 sm:flex-initial rounded-full px-4 text-[13.5px] font-medium transition-all cursor-pointer ${
                      breakdownMode === "LAB_BLOCK"
                        ? "bg-[#111111] text-white shadow-[0_4px_12px_rgba(0,0,0,0.14)]"
                        : "text-[#4B4B47] hover:text-[#111111]"
                    }`}
                  >
                    By Lab Block
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={breakdownMode === "CATEGORY"}
                    onClick={() => setBreakdownMode("CATEGORY")}
                    className={`min-h-[44px] flex-1 sm:flex-initial rounded-full px-4 text-[13.5px] font-medium transition-all cursor-pointer ${
                      breakdownMode === "CATEGORY"
                        ? "bg-[#111111] text-white shadow-[0_4px_12px_rgba(0,0,0,0.14)]"
                        : "text-[#4B4B47] hover:text-[#111111]"
                    }`}
                  >
                    By Category
                  </button>
                </div>
              </div>

              <div className="mt-5 h-[280px] w-full min-w-0 rounded-[20px] bg-[#FAFAF8] p-3 ring-1 ring-black/[0.04]">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-[14px] text-[#5E5E5A]">
                    Loading campus breakdown…
                  </div>
                ) : breakdownData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[14px] text-[#5E5E5A]">
                    No inventory breakdown data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={breakdownData}
                      margin={{ top: 10, right: 8, left: -12, bottom: 4 }}
                      barGap={6}
                      barCategoryGap="24%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(17,17,17,0.08)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortName"
                        tick={{ fontSize: 12, fill: "#4B4B47" }}
                        axisLine={{ stroke: "rgba(17,17,17,0.12)" }}
                        tickLine={false}
                        interval={0}
                        height={36}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#4B4B47" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(17,17,17,0.04)", radius: 10 }}
                        content={<BreakdownTooltip />}
                      />
                      <Bar
                        dataKey="available"
                        name="Available"
                        fill={HEALTH_COLORS.available}
                        stroke="rgba(17,17,17,0.12)"
                        strokeWidth={1}
                        radius={[8, 8, 2, 2]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="inCirculation"
                        name="In Circulation"
                        fill={HEALTH_COLORS.borrowed}
                        radius={[8, 8, 2, 2]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Clean Chart Footer Legend + Summary */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 text-[13.5px]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-2 font-medium text-[#111111]">
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-black/15"
                      style={{ backgroundColor: HEALTH_COLORS.available }}
                    />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-2 font-medium text-[#111111]">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: HEALTH_COLORS.borrowed }}
                    />
                    In Circulation (Borrowed + Reserved)
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F3] px-3 py-1 text-[13px] font-medium text-[#4B4B47] tabular-nums">
                  <Layers className="h-3.5 w-3.5" />
                  Top {breakdownData.length}{" "}
                  {breakdownMode === "LAB_BLOCK" ? "lab blocks" : "categories"}
                </span>
              </div>
            </div>
          </section>

          {/* ================================================================
              Attention Watchlist (Low Stock, Damaged, Missing, Hidden)
          ================================================================ */}
          <section className="rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-7 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">
                    Attention Watchlist
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-3 py-1 text-[13px] font-semibold text-[#C4F041] tabular-nums">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {attentionList.length} part
                    {attentionList.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-[14px] text-[#5E5E5A]">
                  Equipment requiring restock, verification, damage triage, or
                  student catalog visibility updates.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#F5F5F3] px-4 text-[14px] font-medium text-[#111111] ring-1 ring-black/[0.06] transition-colors hover:bg-[#ECECE8] cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </button>
                <Link
                  href="/lab-manager/inventory"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-[14px] font-medium text-white transition-colors hover:bg-black/85"
                >
                  <span>Open Campus Inventory</span>
                  <ArrowUpRight className="h-4 w-4 text-[#C4F041]" />
                </Link>
              </div>
            </div>

            {/* Watchlist Filter Pills */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "ALL", label: "All Attention" },
                  { id: "MISSING", label: "Missing Units" },
                  { id: "DAMAGED", label: "Damaged Units" },
                  { id: "OUT_OF_STOCK", label: "Out of Stock" },
                  { id: "LOW_STOCK", label: "Low Stock" },
                  { id: "HIDDEN", label: "Hidden" },
                ] as const
              ).map((tab) => {
                const isActive = watchlistFilter === tab.id;
                const count = attentionCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setWatchlistFilter(tab.id);
                      setShowAllWatchlist(false);
                    }}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#111111] text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
                        : "bg-[#F6F6F3] text-[#3F3F3B] ring-1 ring-black/[0.05] hover:bg-[#EFEFEB]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums ${
                        isActive
                          ? "bg-white/15 text-[#C4F041]"
                          : "bg-white text-[#111111]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Watchlist Rows */}
            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-[20px] bg-[#FAFAF8] p-8 text-center text-[14px] text-[#5E5E5A] ring-1 ring-black/[0.04]">
                  Evaluating campus inventory health…
                </div>
              ) : displayedAttention.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[20px] bg-[#FAFAF8] px-6 py-10 text-center ring-1 ring-black/[0.04]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C4F041] text-[#111111]">
                    <CheckCircle2 className="h-6 w-6" />
                  </span>
                  <h3 className="mt-3 text-[16px] font-semibold text-[#111111]">
                    No items match this attention filter
                  </h3>
                  <p className="mt-1 max-w-md text-[14px] text-[#5E5E5A]">
                    Your campus stock levels, item conditions, and catalog
                    visibility look healthy here.
                  </p>
                </div>
              ) : (
                displayedAttention.map((entry) => {
                  const { row, labBlock, reasons } = entry;
                  const imgSrc =
                    row.item.imageUrl ||
                    getPartImageUrl(row.item.code, row.item.category?.slug);

                  return (
                    <div
                      key={row.id}
                      className="flex flex-col gap-4 rounded-[20px] bg-[#FAFAF8] p-4 sm:p-5 ring-1 ring-black/[0.05] transition-all hover:bg-white hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between"
                    >
                      {/* Thumbnail + Identity */}
                      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
                        <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06]">
                          <img
                            src={imgSrc}
                            alt={row.item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-[15px] font-semibold text-[#111111]">
                              {row.item.name}
                            </h3>
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] font-medium text-[#5E5E5A] ring-1 ring-black/[0.06]">
                              {row.item.code}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-[13.5px] text-[#5E5E5A]">
                            {labBlock} · {row.item.category?.name ?? "General"}
                          </p>

                          {/* Reason Labels */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {reasons.map((reason) => {
                              const meta = REASON_META[reason];
                              return (
                                <span
                                  key={reason}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${meta.bg} ${meta.text}`}
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${meta.dot}`}
                                  />
                                  {meta.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Exact Counts + Direct Action Link */}
                      <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between md:shrink-0 md:border-t-0 md:pt-0">
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2.5 tabular-nums">
                          <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-black/[0.05]">
                            <p className="text-[13px] text-[#5E5E5A]">Avail</p>
                            <p className="text-[15px] font-semibold text-[#111111]">
                              {formatNumber(row.availableQuantity)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-black/[0.05]">
                            <p className="text-[13px] text-[#5E5E5A]">Out</p>
                            <p className="text-[15px] font-semibold text-[#111111]">
                              {formatNumber(
                                row.borrowedQuantity + row.reservedQuantity
                              )}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-black/[0.05]">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Dmg/Miss
                            </p>
                            <p
                              className={`text-[15px] font-semibold ${
                                row.damagedQuantity + row.missingQuantity > 0
                                  ? "text-[#B91C1C]"
                                  : "text-[#111111]"
                              }`}
                            >
                              {formatNumber(row.damagedQuantity)}/
                              {formatNumber(row.missingQuantity)}
                            </p>
                          </div>
                        </div>

                        <Link
                          href="/lab-manager/inventory"
                          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-medium text-[#111111] ring-1 ring-black/[0.1] transition-all hover:bg-[#C4F041] hover:ring-black/[0.15]"
                        >
                          <span>Manage Stock</span>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Expand / Collapse Watchlist Footer */}
            {filteredAttention.length > 8 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
                <p className="text-[13.5px] text-[#5E5E5A] tabular-nums">
                  Showing {displayedAttention.length} of{" "}
                  {filteredAttention.length} items needing attention
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllWatchlist((prev) => !prev)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#F5F5F3] px-5 text-[14px] font-medium text-[#111111] ring-1 ring-black/[0.06] transition-colors hover:bg-[#ECECE8] cursor-pointer"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>
                    {showAllWatchlist
                      ? "Show Top 8"
                      : `Show All ${filteredAttention.length} Items`}
                  </span>
                </button>
              </div>
            )}
          </section>
        </div>
      </DottedGridCanvas>
    </div>
  );
}
