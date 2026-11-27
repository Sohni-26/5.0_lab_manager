"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  History,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { loadDemoTransactions } from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import {
  cn,
  exportToCsv,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  getInitials,
} from "@/lib/utils";
import {
  ROLE_LABELS,
  type InventoryTransactionDTO,
  type InventoryTransactionType,
} from "@/types/contracts";

type LedgerCategory =
  | "ALL"
  | "RECEIVED"
  | "ISSUED_RESERVED"
  | "RETURNED"
  | "ADJUSTMENTS"
  | "DAMAGED_MISSING";

interface TransactionMeta {
  label: string;
  category: Exclude<LedgerCategory, "ALL">;
  direction: "in" | "out" | "incident" | "neutral";
  dotClass: string;
  pillClass: string;
  deltaClass: string;
}

const TXN_STORAGE_KEY = "campuslab_demo_transactions_v1";
const PAGE_STEP = 15;

const RECEIVED_TYPES: InventoryTransactionType[] = [
  "STOCK_RECEIVED",
  "STOCK_ALLOCATED",
  "STOCK_DISPATCHED",
];

const ISSUED_RESERVED_TYPES: InventoryTransactionType[] = [
  "ITEM_ISSUED",
  "STOCK_RESERVED",
];

const RETURNED_TYPES: InventoryTransactionType[] = [
  "ITEM_RETURNED",
  "RESERVATION_RELEASED",
];

const ADJUSTMENT_TYPES: InventoryTransactionType[] = ["INVENTORY_ADJUSTMENT"];

const INCIDENT_TYPES: InventoryTransactionType[] = [
  "DAMAGED_REPORTED",
  "MISSING_REPORTED",
  "ITEM_MARKED_DAMAGED",
  "ITEM_MARKED_MISSING",
];

function getTransactionMeta(txn: InventoryTransactionDTO): TransactionMeta {
  switch (txn.type) {
    case "STOCK_RECEIVED":
      return {
        label: "Stock Received",
        category: "RECEIVED",
        direction: "in",
        dotClass: "bg-[#5B9A3A]",
        pillClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
        deltaClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
      };
    case "STOCK_ALLOCATED":
      return {
        label: "Stock Allocated",
        category: "RECEIVED",
        direction: "in",
        dotClass: "bg-[#5B9A3A]",
        pillClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
        deltaClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
      };
    case "STOCK_DISPATCHED":
      return {
        label: "Dispatch Logged",
        category: "RECEIVED",
        direction: "in",
        dotClass: "bg-[#5B9A3A]",
        pillClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
        deltaClass: "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20",
      };
    case "ITEM_RETURNED":
      return {
        label: "Item Returned",
        category: "RETURNED",
        direction: "in",
        dotClass: "bg-[#2C7A7B]",
        pillClass: "bg-[#E6F6F5] text-[#1A4D4E] ring-1 ring-[#2C7A7B]/20",
        deltaClass: "bg-[#E6F6F5] text-[#1A4D4E] ring-1 ring-[#2C7A7B]/20",
      };
    case "RESERVATION_RELEASED":
      return {
        label: "Hold Released",
        category: "RETURNED",
        direction: "in",
        dotClass: "bg-[#2C7A7B]",
        pillClass: "bg-[#E6F6F5] text-[#1A4D4E] ring-1 ring-[#2C7A7B]/20",
        deltaClass: "bg-[#E6F6F5] text-[#1A4D4E] ring-1 ring-[#2C7A7B]/20",
      };
    case "ITEM_ISSUED":
      return {
        label: "Issued to Student",
        category: "ISSUED_RESERVED",
        direction: "out",
        dotClass: "bg-[#2B6CB0]",
        pillClass: "bg-[#E7F2FD] text-[#1A4574] ring-1 ring-[#2B6CB0]/20",
        deltaClass: "bg-[#E7F2FD] text-[#1A4574] ring-1 ring-[#2B6CB0]/20",
      };
    case "STOCK_RESERVED":
      return {
        label: "Stock Reserved",
        category: "ISSUED_RESERVED",
        direction: "out",
        dotClass: "bg-[#3B82C4]",
        pillClass: "bg-[#EBF4FC] text-[#1D4E7E] ring-1 ring-[#3B82C4]/20",
        deltaClass: "bg-[#EBF4FC] text-[#1D4E7E] ring-1 ring-[#3B82C4]/20",
      };
    case "DAMAGED_REPORTED":
    case "ITEM_MARKED_DAMAGED":
      return {
        label: txn.type === "DAMAGED_REPORTED" ? "Damaged on Receipt" : "Marked Damaged",
        category: "DAMAGED_MISSING",
        direction: "incident",
        dotClass: "bg-[#D9532F]",
        pillClass: "bg-[#FDECE6] text-[#8F2D12] ring-1 ring-[#D9532F]/20",
        deltaClass: "bg-[#FDECE6] text-[#8F2D12] ring-1 ring-[#D9532F]/20",
      };
    case "MISSING_REPORTED":
    case "ITEM_MARKED_MISSING":
      return {
        label: txn.type === "MISSING_REPORTED" ? "Missing on Receipt" : "Marked Missing",
        category: "DAMAGED_MISSING",
        direction: "incident",
        dotClass: "bg-[#C2410C]",
        pillClass: "bg-[#FEF0E6] text-[#8A2E09] ring-1 ring-[#C2410C]/20",
        deltaClass: "bg-[#FEF0E6] text-[#8A2E09] ring-1 ring-[#C2410C]/20",
      };
    case "INVENTORY_ADJUSTMENT":
    default: {
      const diff = txn.updatedQuantity - txn.previousQuantity;
      const isPositive = diff > 0 || (diff === 0 && txn.quantity > 0);
      return {
        label: "Manual Adjustment",
        category: "ADJUSTMENTS",
        direction: isPositive ? "in" : diff < 0 ? "out" : "neutral",
        dotClass: isPositive ? "bg-[#5B9A3A]" : "bg-[#B7791F]",
        pillClass: "bg-[#FBF3E0] text-[#744A0C] ring-1 ring-[#B7791F]/25",
        deltaClass: isPositive
          ? "bg-[#EEF9D6] text-[#234B12] ring-1 ring-[#5B9A3A]/20"
          : diff < 0
            ? "bg-[#FBF3E0] text-[#744A0C] ring-1 ring-[#B7791F]/25"
            : "bg-[#F3F3F0] text-[#4A4A46] ring-1 ring-black/10",
      };
    }
  }
}

function getDeltaDisplay(txn: InventoryTransactionDTO, meta: TransactionMeta): string {
  const diff = txn.updatedQuantity - txn.previousQuantity;
  if (meta.direction === "incident") {
    const count = Math.abs(diff !== 0 ? diff : txn.quantity);
    return count > 0 ? `+${formatNumber(count)} flagged` : "0";
  }
  if (diff !== 0) {
    return diff > 0
      ? `+${formatNumber(diff)}`
      : `−${formatNumber(Math.abs(diff))}`;
  }
  const absQty = Math.abs(txn.quantity);
  if (absQty === 0) return "0";
  if (meta.direction === "out") return `−${formatNumber(absQty)}`;
  if (meta.direction === "in") return `+${formatNumber(absQty)}`;
  return txn.quantity > 0
    ? `+${formatNumber(txn.quantity)}`
    : `−${formatNumber(absQty)}`;
}

function formatReferenceLabel(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined
): string | null {
  if (!referenceId) return null;
  if (!referenceType) return referenceId;
  const cleanType = referenceType
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return `${cleanType} · ${referenceId}`;
}

function downloadCsv(rows: InventoryTransactionDTO[]) {
  if (rows.length === 0) {
    toast.error("No ledger entries match the current filter to export.");
    return;
  }

  exportToCsv(
    `campus-inventory-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    rows.map((t) => {
      const meta = getTransactionMeta(t);
      return {
        Timestamp: t.createdAt,
        EventLabel: meta.label,
        EventType: t.type,
        ItemCode: t.item?.code ?? "",
        ItemName: t.item?.name ?? t.itemId,
        Quantity: t.quantity,
        PreviousStock: t.previousQuantity,
        UpdatedStock: t.updatedQuantity,
        Delta: getDeltaDisplay(t, meta),
        ReferenceType: t.referenceType ?? "",
        ReferenceId: t.referenceId ?? "",
        PerformedBy: t.performedBy?.fullName ?? "System",
        ActorRole: t.performedBy?.role
          ? ROLE_LABELS[t.performedBy.role]
          : "System",
        Remarks: t.remarks ?? "",
      };
    })
  );

  toast.success(
    `Exported ${formatNumber(rows.length)} ledger ${rows.length === 1 ? "entry" : "entries"} to CSV`
  );
}

const FILTER_TABS: Array<{ key: LedgerCategory; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "RECEIVED", label: "Received" },
  { key: "ISSUED_RESERVED", label: "Issued & Reserved" },
  { key: "RETURNED", label: "Returned" },
  { key: "ADJUSTMENTS", label: "Adjustments" },
  { key: "DAMAGED_MISSING", label: "Damaged / Missing" },
];

export default function LabManagerHistoryPage() {
  const { isDemoMode } = useAuth();
  const [transactions, setTransactions] = useState<InventoryTransactionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [livePulse, setLivePulse] = useState(false);
  const [category, setCategory] = useState<LedgerCategory>("ALL");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setRefreshing(true);
      }
      if (isDemoMode) {
        setTransactions(loadDemoTransactions());
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        const res = await apiClient.inventory.transactions({ pageSize: 150 });
        setTransactions(res.data);
      } catch {
        setTransactions(loadDemoTransactions());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isDemoMode]
  );

  useEffect(() => {
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  // Cross-tab localStorage sync for demo store transactions
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TXN_STORAGE_KEY) {
        setTransactions(loadDemoTransactions());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: [
      "inventory.updated",
      "allocation.verified",
      "request.status_changed",
      "borrowing.issued",
      "return.submitted",
      "return.verified",
    ],
    onEvent: () => {
      setLivePulse(true);
      void load({ silent: true });
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setLivePulse(false), 1800);
    },
    onReconnect: () => {
      void load({ silent: true });
    },
  });

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_STEP);
  }, [category, search]);

  const stats = useMemo(() => {
    let unitsIn = 0;
    let unitsOut = 0;
    let incidentAndAdjEvents = 0;
    let damagedMissingUnits = 0;

    const categoryCounts: Record<LedgerCategory, number> = {
      ALL: transactions.length,
      RECEIVED: 0,
      ISSUED_RESERVED: 0,
      RETURNED: 0,
      ADJUSTMENTS: 0,
      DAMAGED_MISSING: 0,
    };

    for (const txn of transactions) {
      const meta = getTransactionMeta(txn);
      categoryCounts[meta.category] += 1;

      const absDiff = Math.abs(txn.updatedQuantity - txn.previousQuantity);
      const units = absDiff > 0 ? absDiff : Math.abs(txn.quantity);

      if (
        RECEIVED_TYPES.includes(txn.type) ||
        RETURNED_TYPES.includes(txn.type)
      ) {
        unitsIn += units;
      } else if (ISSUED_RESERVED_TYPES.includes(txn.type)) {
        unitsOut += units;
      } else if (ADJUSTMENT_TYPES.includes(txn.type)) {
        incidentAndAdjEvents += 1;
      } else if (INCIDENT_TYPES.includes(txn.type)) {
        incidentAndAdjEvents += 1;
        damagedMissingUnits += units;
      }
    }

    return {
      totalEvents: transactions.length,
      unitsIn,
      unitsOut,
      incidentAndAdjEvents,
      damagedMissingUnits,
      categoryCounts,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((txn) => {
      const meta = getTransactionMeta(txn);
      if (category !== "ALL" && meta.category !== category) {
        return false;
      }
      if (!q) return true;

      const roleLabel = txn.performedBy?.role
        ? ROLE_LABELS[txn.performedBy.role].toLowerCase()
        : "system";

      return (
        meta.label.toLowerCase().includes(q) ||
        txn.type.toLowerCase().includes(q) ||
        (txn.item?.name.toLowerCase().includes(q) ?? false) ||
        (txn.item?.code.toLowerCase().includes(q) ?? false) ||
        (txn.performedBy?.fullName.toLowerCase().includes(q) ?? false) ||
        roleLabel.includes(q) ||
        (txn.remarks?.toLowerCase().includes(q) ?? false) ||
        (txn.referenceId?.toLowerCase().includes(q) ?? false) ||
        (txn.referenceType?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, category, search]);

  const visibleTransactions = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const remainingCount = Math.max(0, filtered.length - visibleTransactions.length);

  return (
    <div
      className="w-full min-w-0 space-y-5 overflow-x-clip"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Editorial Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#4A4A46] ring-1 ring-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                livePulse
                  ? "bg-[#72B828] animate-ping"
                  : isDemoMode
                    ? "bg-[#88B830]"
                    : "bg-[#5B9A3A]"
              )}
            />
            <span>
              {livePulse
                ? "Ledger synced just now"
                : isDemoMode
                  ? "Live Campus Ledger · Local Sync"
                  : "Live Campus Ledger · Realtime"}
            </span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-medium leading-tight tracking-[-0.03em] text-black">
            Campus History &amp; Inventory Ledger
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
            Append-only audit trail of every stock receipt, student handover,
            verified return, manual adjustment, and equipment incident.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-black ring-1 ring-black/[0.08] shadow-[0_4px_14px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#F5F5F2] disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-[#4A4A46]", refreshing && "animate-spin")}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Light Dotted-Grid Editorial Surface */}
      <DottedGridCanvas
        pannable={false}
        className="flex flex-col rounded-[24px] sm:rounded-[28px] p-4 sm:p-6 lg:p-7"
      >
        <div className="flex flex-1 flex-col gap-4 sm:gap-5">
          {/* 4-Stat Summary Strip */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Total Ledger Events
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F2] text-black">
                  <History className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] sm:text-[34px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {formatNumber(stats.totalEvents)}
              </p>
              <p className="mt-2 text-[13px] text-[#6B6B66]">
                {filtered.length === stats.totalEvents
                  ? "Append-only records"
                  : `${formatNumber(filtered.length)} matching filter`}
              </p>
            </div>

            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Received / Returned
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF9D6] text-[#234B12]">
                  <ArrowDownLeft className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] sm:text-[34px] font-semibold leading-none tracking-[-0.03em] text-[#234B12] tabular-nums">
                +{formatNumber(stats.unitsIn)}
              </p>
              <p className="mt-2 text-[13px] text-[#6B6B66]">
                Units added back to shelf
              </p>
            </div>

            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Issued / Reserved
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7F2FD] text-[#1A4574]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] sm:text-[34px] font-semibold leading-none tracking-[-0.03em] text-[#1A4574] tabular-nums">
                −{formatNumber(stats.unitsOut)}
              </p>
              <p className="mt-2 text-[13px] text-[#6B6B66]">
                Units checked out or held
              </p>
            </div>

            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Adjustments &amp; Incidents
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDECE6] text-[#8F2D12]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] sm:text-[34px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {formatNumber(stats.incidentAndAdjEvents)}
              </p>
              <p className="mt-2 text-[13px] text-[#6B6B66]">
                {stats.damagedMissingUnits > 0
                  ? `${formatNumber(stats.damagedMissingUnits)} damaged or missing`
                  : "Manual & incident logs"}
              </p>
            </div>
          </div>

          {/* Filter Bar: Scrollable Category Pills + Search + Export CSV */}
          <div className="rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] space-y-3.5">
            {/* Horizontally Scrollable Category Pills */}
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTER_TABS.map((tab) => {
                const active = category === tab.key;
                const count = stats.categoryCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCategory(tab.key)}
                    className={cn(
                      "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-all",
                      active
                        ? "bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                        : "bg-[#F6F6F3] text-[#3F3F3B] ring-1 ring-black/[0.05] hover:bg-[#ECECE7] hover:text-black"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-[13px] font-medium tabular-nums",
                        active
                          ? "bg-white/15 text-white"
                          : "bg-white text-[#5E5E5A] ring-1 ring-black/[0.06]"
                      )}
                    >
                      {formatNumber(count)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input + 1-Click Export CSV */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B66]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search part name, SKU code, actor, remarks, or reference ID..."
                  aria-label="Search inventory ledger"
                  className="min-h-[44px] w-full rounded-full bg-[#F7F7F4] pl-11 pr-11 text-[16px] sm:text-[14px] text-black placeholder:text-[#787872] ring-1 ring-black/[0.07] transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#5E5E5A] transition-colors hover:bg-black/[0.06] hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5 sm:justify-end">
                <span className="text-[13.5px] font-medium text-[#5E5E5A] tabular-nums">
                  {formatNumber(filtered.length)}{" "}
                  {filtered.length === 1 ? "entry" : "entries"}
                </span>

                <button
                  type="button"
                  onClick={() => downloadCsv(filtered)}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-black px-5 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#C4F041] hover:text-black"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Body */}
          {loading ? (
            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-10 text-center ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F6F6F3] text-[#4A4A46]">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
              <p className="text-[15px] font-medium text-black">
                Loading campus inventory ledger...
              </p>
              <p className="mt-1 text-[13.5px] text-[#5E5E5A]">
                Syncing stock receipts, issues, returns, and adjustments.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-8 sm:p-12 text-center ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3FBD4] text-black ring-1 ring-black/[0.06]">
                {transactions.length === 0 ? (
                  <PackageCheck className="h-5 w-5" />
                ) : (
                  <SlidersHorizontal className="h-5 w-5" />
                )}
              </div>
              <h2 className="text-[20px] sm:text-[22px] font-medium tracking-[-0.025em] text-black">
                {transactions.length === 0
                  ? "No ledger transactions recorded yet"
                  : "No ledger entries match your filters"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#5E5E5A]">
                {transactions.length === 0
                  ? "Every stock receipt, student checkout, return verification, and inventory adjustment will appear here automatically."
                  : "Try clearing your search query or switching back to All categories to inspect the full ledger."}
              </p>
              {(category !== "ALL" || search.trim() !== "") && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory("ALL");
                      setSearch("");
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#F6F6F3] px-5 text-[14px] font-medium text-black ring-1 ring-black/[0.08] transition-colors hover:bg-[#C4F041]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reset filters</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Vertical Timeline Cards (< md) */}
              <div className="space-y-3 md:hidden">
                {visibleTransactions.map((txn) => {
                  const meta = getTransactionMeta(txn);
                  const deltaLabel = getDeltaDisplay(txn, meta);
                  const partCode = txn.item?.code ?? "";
                  const partName = txn.item?.name ?? txn.itemId;
                  const imgUrl = getPartImageUrl(partCode);
                  const actorName = txn.performedBy?.fullName ?? "System";
                  const actorRole = txn.performedBy?.role
                    ? ROLE_LABELS[txn.performedBy.role]
                    : "Automated";
                  const refLabel = formatReferenceLabel(
                    txn.referenceType,
                    txn.referenceId
                  );

                  return (
                    <article
                      key={txn.id}
                      className="rounded-[24px] bg-white p-4 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] space-y-3.5"
                    >
                      {/* Top Row: Thumbnail + Part Identity + Event Type */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-[#F7F7F4] p-1.5 ring-1 ring-black/[0.06]">
                          <img
                            src={imgUrl}
                            alt={partName}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[15px] font-medium leading-snug text-black break-words">
                            {partName}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {partCode && (
                              <span className="text-[13px] text-[#5E5E5A]">
                                {partCode}
                              </span>
                            )}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium",
                                meta.pillClass
                              )}
                            >
                              <span
                                className={cn(
                                  "h-2 w-2 shrink-0 rounded-full",
                                  meta.dotClass
                                )}
                              />
                              <span>{meta.label}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Transition Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-[#F8F8F5] px-3.5 py-2.5 ring-1 ring-black/[0.04]">
                        <div className="flex items-center gap-2 text-[13.5px] tabular-nums text-[#5E5E5A]">
                          <span>{formatNumber(txn.previousQuantity)}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-[#8A8A84]" />
                          <span className="font-semibold text-black">
                            {formatNumber(txn.updatedQuantity)}
                          </span>
                          <span className="font-sans text-[13px] text-[#6B6B66]">
                            units
                          </span>
                        </div>

                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-semibold tabular-nums",
                            meta.deltaClass
                          )}
                        >
                          {deltaLabel}
                        </span>
                      </div>

                      {/* Remarks & Reference */}
                      {(txn.remarks || refLabel) && (
                        <div className="space-y-1.5 text-[13.5px] leading-relaxed text-[#3F3F3B]">
                          {txn.remarks && (
                            <p className="break-words">{txn.remarks}</p>
                          )}
                          {refLabel && (
                            <p className="text-[13px] text-[#6B6B66] break-all">
                              Ref: {refLabel}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Footer: Actor + Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F3EE] text-[13px] font-medium text-black ring-1 ring-black/[0.06]">
                            {getInitials(actorName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-black">
                              {actorName}
                            </p>
                            <p className="truncate text-[13px] text-[#6B6B66]">
                              {actorRole}
                            </p>
                          </div>
                        </div>

                        <div className="text-right tabular-nums">
                          <p className="text-[13.5px] font-medium text-black">
                            {formatRelativeTime(txn.createdAt)}
                          </p>
                          <p className="text-[13px] text-[#6B6B66]">
                            {formatDateTime(txn.createdAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop Soft Architectural Ledger Table (>= md) */}
              <div className="hidden md:block rounded-[28px] bg-white ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-black/[0.06] bg-[#F9F9F6] text-[13px] font-medium text-[#5E5E5A]">
                        <th className="py-4 pl-6 pr-4 font-medium">Equipment</th>
                        <th className="px-4 py-4 font-medium">Transaction</th>
                        <th className="px-4 py-4 font-medium">
                          Stock Transition
                        </th>
                        <th className="px-4 py-4 font-medium">Remarks</th>
                        <th className="px-4 py-4 font-medium">Actor</th>
                        <th className="py-4 pl-4 pr-6 text-right font-medium">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {visibleTransactions.map((txn) => {
                        const meta = getTransactionMeta(txn);
                        const deltaLabel = getDeltaDisplay(txn, meta);
                        const partCode = txn.item?.code ?? "";
                        const partName = txn.item?.name ?? txn.itemId;
                        const imgUrl = getPartImageUrl(partCode);
                        const actorName = txn.performedBy?.fullName ?? "System";
                        const actorRole = txn.performedBy?.role
                          ? ROLE_LABELS[txn.performedBy.role]
                          : "Automated";
                        const refLabel = formatReferenceLabel(
                          txn.referenceType,
                          txn.referenceId
                        );

                        return (
                          <tr
                            key={txn.id}
                            className="transition-colors hover:bg-[#FAFAF7]"
                          >
                            {/* Equipment */}
                            <td className="py-4 pl-6 pr-4 align-middle">
                              <div className="flex items-center gap-3.5 min-w-[220px]">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-[#F7F7F4] p-1.5 ring-1 ring-black/[0.06]">
                                  <img
                                    src={imgUrl}
                                    alt={partName}
                                    loading="lazy"
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14.5px] font-medium leading-snug text-black">
                                    {partName}
                                  </p>
                                  {partCode && (
                                    <p className="mt-0.5 text-[13px] text-[#6B6B66]">
                                      {partCode}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Transaction */}
                            <td className="px-4 py-4 align-middle whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium",
                                    meta.pillClass
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      meta.dotClass
                                    )}
                                  />
                                  <span>{meta.label}</span>
                                </span>
                                {txn.referenceId && (
                                  <span className="text-[13px] text-[#6B6B66]">
                                    {txn.referenceId}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Previous -> Updated + Delta */}
                            <td className="px-4 py-4 align-middle whitespace-nowrap">
                              <div className="inline-flex items-center gap-2.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F7F4] px-3 py-1 text-[13.5px] tabular-nums text-[#5E5E5A] ring-1 ring-black/[0.05]">
                                  <span>{formatNumber(txn.previousQuantity)}</span>
                                  <ArrowRight className="h-3.5 w-3.5 text-[#8A8A84]" />
                                  <strong className="font-semibold text-black">
                                    {formatNumber(txn.updatedQuantity)}
                                  </strong>
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums",
                                    meta.deltaClass
                                  )}
                                >
                                  {deltaLabel}
                                </span>
                              </div>
                            </td>

                            {/* Remarks */}
                            <td className="px-4 py-4 align-middle max-w-[280px]">
                              <p
                                className="line-clamp-2 text-[13.5px] leading-relaxed text-[#3F3F3B]"
                                title={txn.remarks ?? refLabel ?? undefined}
                              >
                                {txn.remarks ?? "—"}
                              </p>
                            </td>

                            {/* Actor */}
                            <td className="px-4 py-4 align-middle whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F3EE] text-[13px] font-medium text-black ring-1 ring-black/[0.06]">
                                  {getInitials(actorName)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[14px] font-medium text-black">
                                    {actorName}
                                  </p>
                                  <p className="text-[13px] text-[#6B6B66]">
                                    {actorRole}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td className="py-4 pl-4 pr-6 align-middle text-right whitespace-nowrap tabular-nums">
                              <p className="text-[14px] font-medium text-black">
                                {formatRelativeTime(txn.createdAt)}
                              </p>
                              <p className="mt-0.5 text-[13px] text-[#6B6B66]">
                                {formatDateTime(txn.createdAt)}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Load-More / Pagination Footer */}
              <div className="flex flex-col gap-3 rounded-[24px] bg-white px-5 py-3.5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-[#5E5E5A] tabular-nums">
                  Showing{" "}
                  <strong className="font-semibold text-black">
                    {formatNumber(visibleTransactions.length)}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-semibold text-black">
                    {formatNumber(filtered.length)}
                  </strong>{" "}
                  ledger {filtered.length === 1 ? "event" : "events"}
                </p>

                {remainingCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((prev) => prev + PAGE_STEP)
                      }
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-black px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#C4F041] hover:text-black"
                    >
                      Load {formatNumber(Math.min(PAGE_STEP, remainingCount))}{" "}
                      more
                    </button>
                    {remainingCount > PAGE_STEP && (
                      <button
                        type="button"
                        onClick={() => setVisibleCount(filtered.length)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#F6F6F3] px-4 text-[14px] font-medium text-black ring-1 ring-black/[0.07] transition-colors hover:bg-[#ECECE7]"
                      >
                        Show all ({formatNumber(filtered.length)})
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[13px] text-[#6B6B66]">
                    End of ledger
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </DottedGridCanvas>
    </div>
  );
}
