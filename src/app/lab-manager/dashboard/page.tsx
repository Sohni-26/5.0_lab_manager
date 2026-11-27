"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  PackageCheck,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { FLOW_PALETTES } from "@/components/dashboard/request-flowchart";
import { LoopsiiButton } from "@/components/landing/primitives";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useMultiPinSelection } from "@/hooks/use-multi-pin";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import {
  adjustDemoInventoryStock,
  loadDemoAllocations,
  loadDemoCampusInventory,
  loadDemoTickets,
  toggleDemoInventoryVisibility,
  updateDemoTicket,
} from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  ISSUE_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/utils";
import type {
  CampusInventoryDTO,
  IssueTicketDTO,
  StockAllocationDTO,
  TicketPriority,
  TicketStatus,
} from "@/types/contracts";

type LabBoardTab = "ALLOCATIONS" | "TICKETS" | "ALERTS";

interface LabBoardItem {
  id: string;
  kind: LabBoardTab;
  title: string;
  subtitle: string;
  statusLabel: string;
  allocation?: StockAllocationDTO;
  ticket?: IssueTicketDTO;
  inventory?: CampusInventoryDTO;
}

const PAGE_SIZE = 4;

const WATCHED_REALTIME_EVENTS = new Set<string>([
  "allocation.created",
  "allocation.status_changed",
  "allocation.verified",
  "ticket.created",
  "ticket.updated",
  "inventory.updated",
  "inventory.visibility_changed",
  "visibility.changed",
  "request.created",
  "request.status_changed",
  "request.returned",
  "borrowing.issued",
  "return.submitted",
  "return.verified",
]);

const PRIORITY_DOT_CLASS: Record<TicketPriority, string> = {
  CRITICAL: "bg-[#D94A2A]",
  HIGH: "bg-[#E87A3E]",
  MEDIUM: "bg-[#D49B27]",
  LOW: "bg-[#6E8B6E]",
};

function isPendingAllocation(a: StockAllocationDTO): boolean {
  return (
    a.status === "DISPATCHED" ||
    a.status === "PARTIALLY_RECEIVED" ||
    a.status === "DRAFT"
  );
}

function isOpenTicket(t: IssueTicketDTO): boolean {
  return t.status !== "RESOLVED" && t.status !== "CLOSED";
}

function isAlertInventory(inv: CampusInventoryDTO): boolean {
  return (
    inv.availableQuantity <= 3 ||
    !inv.isVisible ||
    inv.damagedQuantity > 0 ||
    inv.missingQuantity > 0
  );
}

function getAlertTags(inv: CampusInventoryDTO): string[] {
  const tags: string[] = [];
  if (inv.availableQuantity === 0) {
    tags.push("Out of stock");
  } else if (inv.availableQuantity <= 3) {
    tags.push(`Low: ${inv.availableQuantity} left`);
  }
  if (!inv.isVisible) {
    tags.push("Hidden");
  }
  if (inv.damagedQuantity > 0) {
    tags.push(`${inv.damagedQuantity} damaged`);
  }
  if (inv.missingQuantity > 0) {
    tags.push(`${inv.missingQuantity} missing`);
  }
  return tags;
}

function getLabBlock(inv: CampusInventoryDTO): string | null {
  const specs = inv.item.specifications;
  if (!specs) return null;
  if (typeof specs.lab === "string" && specs.lab.trim()) return specs.lab;
  if (typeof specs.labBlock === "string" && specs.labBlock.trim()) {
    return specs.labBlock;
  }
  return null;
}

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

export default function LabManagerDashboardPage() {
  const { user, isDemoMode } = useAuth();
  const [tab, setTab] = useState<LabBoardTab>("ALLOCATIONS");
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [busyInvId, setBusyInvId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setInventory(loadDemoCampusInventory());
      setAllocations(loadDemoAllocations());
      setTickets(loadDemoTickets());
      setLoading(false);
      return;
    }
    try {
      const [invRes, allocRes, ticketRes] = await Promise.all([
        apiClient.inventory
          .list({ pageSize: 250 })
          .catch(() => ({ data: loadDemoCampusInventory() })),
        apiClient.allocations
          .list({ pageSize: 40 })
          .catch(() => ({ data: loadDemoAllocations() })),
        apiClient.tickets
          .list({ pageSize: 40 })
          .catch(() => ({ data: loadDemoTickets() })),
      ]);
      setInventory(invRes.data);
      setAllocations(allocRes.data);
      setTickets(ticketRes.data);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const { status: realtimeStatus } = useRealtime({
    enabled: true,
    isDemoMode,
    onEvent: (event) => {
      if (WATCHED_REALTIME_EVENTS.has(event.type)) {
        void load();
      }
    },
    onReconnect: () => {
      void load();
    },
  });

  // Campus Pulse KPI Metrics
  const metrics = useMemo(() => {
    let availableUnits = 0;
    let visibleSkus = 0;
    let borrowedUnits = 0;
    let reservedUnits = 0;
    let lowOrOutCount = 0;
    let damagedOrMissingUnits = 0;

    for (const row of inventory) {
      availableUnits += row.availableQuantity;
      if (row.isVisible) visibleSkus += 1;
      borrowedUnits += row.borrowedQuantity;
      reservedUnits += row.reservedQuantity;
      if (row.availableQuantity <= 3) lowOrOutCount += 1;
      damagedOrMissingUnits += row.damagedQuantity + row.missingQuantity;
    }

    const pendingDispatches = allocations.filter(isPendingAllocation).length;
    const openTickets = tickets.filter(isOpenTicket).length;

    return {
      availableUnits,
      visibleSkus,
      totalSkus: inventory.length,
      circulationUnits: borrowedUnits + reservedUnits,
      borrowedUnits,
      reservedUnits,
      lowOrOutCount,
      damagedOrMissingUnits,
      pendingDispatches,
      openTickets,
      actionQueueTotal: pendingDispatches + openTickets,
    };
  }, [inventory, allocations, tickets]);

  const sortedAllocations = useMemo(() => {
    const rank = (s: StockAllocationDTO["status"]) => {
      if (s === "DISPATCHED") return 0;
      if (s === "PARTIALLY_RECEIVED") return 1;
      if (s === "DISCREPANCY_REPORTED") return 2;
      if (s === "DRAFT") return 3;
      if (s === "RECEIVED") return 4;
      return 5;
    };
    return [...allocations].sort((a, b) => rank(a.status) - rank(b.status));
  }, [allocations]);

  const sortedTickets = useMemo(() => {
    const statusRank = (s: TicketStatus) => {
      if (s === "OPEN" || s === "REOPENED") return 0;
      if (s === "IN_PROGRESS" || s === "ASSIGNED") return 1;
      return 2;
    };
    const priorityRank = (p: TicketPriority) => {
      if (p === "CRITICAL") return 0;
      if (p === "HIGH") return 1;
      if (p === "MEDIUM") return 2;
      return 3;
    };
    return [...tickets].sort((a, b) => {
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });
  }, [tickets]);

  const alertInventory = useMemo(() => {
    const score = (inv: CampusInventoryDTO) => {
      let s = 0;
      if (inv.availableQuantity === 0) s += 100;
      else if (inv.availableQuantity <= 3) s += 40 - inv.availableQuantity * 5;
      if (inv.damagedQuantity > 0 || inv.missingQuantity > 0) s += 60;
      if (!inv.isVisible) s += 20;
      return s;
    };
    return inventory
      .filter(isAlertInventory)
      .sort((a, b) => score(b) - score(a));
  }, [inventory]);

  const boardItems = useMemo<LabBoardItem[]>(() => {
    if (tab === "ALLOCATIONS") {
      return sortedAllocations.map((a) => {
        const totalAllocated = a.items.reduce(
          (sum, it) => sum + it.allocatedQuantity,
          0
        );
        const totalReceived = a.items.reduce(
          (sum, it) => sum + it.receivedQuantity,
          0
        );
        return {
          id: a.id,
          kind: "ALLOCATIONS",
          title: a.notes?.trim() || "Incoming Stock Dispatch",
          subtitle: `${a.referenceCode} · ${a.items.length} SKU${a.items.length === 1 ? "" : "s"} · ${totalReceived}/${totalAllocated} units`,
          statusLabel: formatStatusLabel(a.status),
          allocation: a,
        };
      });
    }
    if (tab === "TICKETS") {
      return sortedTickets.map((t) => ({
        id: t.id,
        kind: "TICKETS",
        title: t.title,
        subtitle: `${t.ticketCode} · ${t.item?.name || ISSUE_CATEGORY_LABELS[t.category] || "Campus Equipment"}`,
        statusLabel: formatStatusLabel(t.status),
        ticket: t,
      }));
    }
    return alertInventory.map((inv) => {
      const tags = getAlertTags(inv);
      return {
        id: inv.id,
        kind: "ALERTS",
        title: inv.item.name,
        subtitle: `${inv.item.code} · ${inv.item.category.name}`,
        statusLabel: tags.slice(0, 2).join(" · "),
        inventory: inv,
      };
    });
  }, [tab, sortedAllocations, sortedTickets, alertInventory]);

  const getItemId = useCallback((item: LabBoardItem) => item.id, []);
  const {
    selectedItems,
    isMultiMode,
    isSelected,
    handleSelect,
    unpin,
    collapseToPrimary,
  } = useMultiPinSelection(boardItems, getItemId, 6);

  const totalPages = Math.max(1, Math.ceil(boardItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(
    () => boardItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [boardItems, safePage]
  );

  const switchTab = useCallback((nextTab: LabBoardTab) => {
    setTab(nextTab);
    setPage(1);
  }, []);

  // Inline Ticket Status Action
  const handleQuickTicketStatus = useCallback(
    async (ticket: IssueTicketDTO, nextStatus: TicketStatus) => {
      setBusyTicketId(ticket.id);
      try {
        if (isDemoMode) {
          const nextList = updateDemoTicket(
            ticket.id,
            { status: nextStatus },
            user
          );
          setTickets(nextList);
          toast.success(
            `${ticket.ticketCode} marked ${formatStatusLabel(nextStatus)}`
          );
          return;
        }
        try {
          const res = await apiClient.tickets.update(ticket.id, {
            status: nextStatus,
          });
          setTickets((prev) =>
            prev.map((t) => (t.id === ticket.id ? res.data : t))
          );
          toast.success(
            `${ticket.ticketCode} marked ${formatStatusLabel(nextStatus)}`
          );
        } catch {
          const nextList = updateDemoTicket(
            ticket.id,
            { status: nextStatus },
            user
          );
          setTickets(nextList);
          toast.success(
            `${ticket.ticketCode} marked ${formatStatusLabel(nextStatus)}`
          );
        }
      } finally {
        setBusyTicketId(null);
      }
    },
    [isDemoMode, user]
  );

  // Inline Inventory Visibility Toggle
  const handleQuickToggleVisibility = useCallback(
    async (inv: CampusInventoryDTO, nextVisible: boolean) => {
      setBusyInvId(inv.id);
      setInventory((prev) =>
        prev.map((row) =>
          row.id === inv.id ? { ...row, isVisible: nextVisible } : row
        )
      );
      try {
        if (isDemoMode) {
          const nextList = toggleDemoInventoryVisibility(
            inv.id,
            nextVisible,
            user
          );
          setInventory(nextList);
          toast.success(
            `${inv.item.name} is now ${nextVisible ? "visible to students" : "hidden from catalog"}`
          );
          return;
        }
        try {
          const res = await apiClient.inventory.toggleVisibility(
            inv.id,
            nextVisible
          );
          setInventory((prev) =>
            prev.map((row) => (row.id === inv.id ? res.data : row))
          );
          toast.success(
            `${inv.item.name} is now ${nextVisible ? "visible to students" : "hidden from catalog"}`
          );
        } catch {
          const nextList = toggleDemoInventoryVisibility(
            inv.id,
            nextVisible,
            user
          );
          setInventory(nextList);
          toast.success(
            `${inv.item.name} is now ${nextVisible ? "visible to students" : "hidden from catalog"}`
          );
        }
      } finally {
        setBusyInvId(null);
      }
    },
    [isDemoMode, user]
  );

  // Inline Quick Restock (+1 / +5)
  const handleQuickRestock = useCallback(
    async (inv: CampusInventoryDTO, delta: number) => {
      setBusyInvId(inv.id);
      const remarks = `Quick restock +${delta} ${inv.item.unit} from Campus Command Board`;
      try {
        if (isDemoMode) {
          const nextList = adjustDemoInventoryStock(
            inv.id,
            { field: "availableQuantity", delta, remarks },
            user
          );
          setInventory(nextList);
          toast.success(
            `Restocked +${delta} ${inv.item.name} (${inv.availableQuantity + delta} available)`
          );
          return;
        }
        try {
          const res = await apiClient.inventory.adjust(inv.id, {
            field: "availableQuantity",
            delta,
            remarks,
          });
          setInventory((prev) =>
            prev.map((row) => (row.id === inv.id ? res.data : row))
          );
          toast.success(
            `Restocked +${delta} ${inv.item.name} (${res.data.availableQuantity} available)`
          );
        } catch {
          const nextList = adjustDemoInventoryStock(
            inv.id,
            { field: "availableQuantity", delta, remarks },
            user
          );
          setInventory(nextList);
          toast.success(
            `Restocked +${delta} ${inv.item.name} (${inv.availableQuantity + delta} available)`
          );
        }
      } finally {
        setBusyInvId(null);
      }
    },
    [isDemoMode, user]
  );

  const campusName = user?.campus?.name ?? "Bengaluru North Campus";

  return (
    <div
      className="w-full min-w-0 space-y-5"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black">
              Campus Operations Board
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-medium text-[#5E5E5A] ring-1 ring-black/[0.06]">
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeStatus === "reconnecting"
                    ? "bg-[#E87A3E]"
                    : "bg-[#288568]"
                }`}
              />
              {campusName}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] sm:text-[14.5px] text-[#5E5E5A]">
            Command stock health, verify incoming dispatches, and resolve campus issues — Ctrl+Click to compare up to 6 side-by-side.
          </p>
        </div>

        <LoopsiiButton
          label="Campus Inventory"
          href="/lab-manager/inventory"
          size="sm"
          hideArrow
        />
      </div>

      {/* Campus Command Pulse Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/lab-manager/inventory"
          className="group min-w-0 rounded-[24px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] transition-all hover:ring-black/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.07)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5E5E5A] truncate">
              Available Units
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F3FBD4] text-black transition-colors group-hover:bg-[#C4F041]">
              <Boxes className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums">
            {formatNumber(metrics.availableUnits)}
          </p>
          <p className="mt-1 text-[13px] text-[#5E5E5A] truncate tabular-nums">
            {metrics.visibleSkus} of {metrics.totalSkus} SKUs visible
          </p>
        </Link>

        <Link
          href="/lab-manager/requests"
          className="group min-w-0 rounded-[24px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] transition-all hover:ring-black/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.07)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5E5E5A] truncate">
              Borrowed &amp; Reserved
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#E8F6FE] text-black transition-colors group-hover:bg-[#BCE6FA]">
              <Repeat className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums">
            {formatNumber(metrics.circulationUnits)}
          </p>
          <p className="mt-1 text-[13px] text-[#5E5E5A] truncate tabular-nums">
            {metrics.borrowedUnits} out · {metrics.reservedUnits} reserved
          </p>
        </Link>

        <button
          type="button"
          onClick={() => switchTab("ALERTS")}
          className={`group min-w-0 rounded-[24px] bg-white p-4 sm:p-5 text-left ring-1 transition-all cursor-pointer ${
            tab === "ALERTS"
              ? "ring-2 ring-black/80 shadow-[0_14px_36px_rgba(0,0,0,0.08)]"
              : "ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] hover:ring-black/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.07)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5E5E5A] truncate">
              Low / Out of Stock
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#FDF1E0] text-black transition-colors group-hover:bg-[#F3BD77]">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums">
            {formatNumber(metrics.lowOrOutCount)}
          </p>
          <p className="mt-1 text-[13px] text-[#5E5E5A] truncate tabular-nums">
            {metrics.damagedOrMissingUnits} damaged or missing
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            switchTab(metrics.pendingDispatches > 0 ? "ALLOCATIONS" : "TICKETS")
          }
          className={`group min-w-0 rounded-[24px] bg-white p-4 sm:p-5 text-left ring-1 transition-all cursor-pointer ${
            tab === "ALLOCATIONS" || tab === "TICKETS"
              ? "ring-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.055)] hover:ring-black/20"
              : "ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] hover:ring-black/15"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5E5E5A] truncate">
              Action Queue
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#FCEAE3] text-black transition-colors group-hover:bg-[#FA8E66]">
              <ClipboardList className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums">
            {formatNumber(metrics.actionQueueTotal)}
          </p>
          <p className="mt-1 text-[13px] text-[#5E5E5A] truncate tabular-nums">
            {metrics.pendingDispatches} dispatches · {metrics.openTickets} tickets
          </p>
        </button>
      </div>

      {/* Main Spatial Operations Canvas */}
      <DottedGridCanvas
        pannable
        className="flex flex-col p-4 pb-20 sm:p-6 sm:pb-20"
      >
        <div className="flex flex-1 flex-col gap-5 min-w-0">
          {/* Top Switcher Bar */}
          <div
            data-canvas-controls="true"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => switchTab("ALLOCATIONS")}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13.5px] sm:text-[14px] font-medium transition-all cursor-pointer ${
                  tab === "ALLOCATIONS"
                    ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                    : "bg-white/95 text-black ring-1 ring-black/[0.06] hover:bg-white"
                }`}
              >
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span>Incoming Stock</span>
                <span
                  className={`tabular-nums ${
                    tab === "ALLOCATIONS" ? "text-[#C4F041]" : "text-[#5E5E5A]"
                  }`}
                >
                  {allocations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchTab("TICKETS")}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13.5px] sm:text-[14px] font-medium transition-all cursor-pointer ${
                  tab === "TICKETS"
                    ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                    : "bg-white/95 text-black ring-1 ring-black/[0.06] hover:bg-white"
                }`}
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Issue Tickets</span>
                <span
                  className={`tabular-nums ${
                    tab === "TICKETS" ? "text-[#C4F041]" : "text-[#5E5E5A]"
                  }`}
                >
                  {tickets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchTab("ALERTS")}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13.5px] sm:text-[14px] font-medium transition-all cursor-pointer ${
                  tab === "ALERTS"
                    ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                    : "bg-white/95 text-black ring-1 ring-black/[0.06] hover:bg-white"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Low Stock &amp; Alerts</span>
                <span
                  className={`tabular-nums ${
                    tab === "ALERTS" ? "text-[#C4F041]" : "text-[#5E5E5A]"
                  }`}
                >
                  {alertInventory.length}
                </span>
              </button>
            </div>

            {isMultiMode ? (
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-[#C4F041] px-3 py-1 text-[13px] font-semibold text-black tabular-nums">
                  {selectedItems.length} pinned
                </span>
                <button
                  type="button"
                  onClick={collapseToPrimary}
                  className="text-[13px] font-medium text-[#5E5E5A] hover:text-black underline decoration-black/25 underline-offset-4 cursor-pointer"
                >
                  Single view
                </button>
              </div>
            ) : (
              <span className="hidden md:inline text-[13px] text-[#5E5E5A]">
                Ctrl+Click cards to pin multiple on board
              </span>
            )}
          </div>

          {/* 2-Column Responsive Master-Detail Split */}
          <div className="grid flex-1 grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start min-w-0">
            {/* Left Queue Deck */}
            <div
              data-canvas-controls="true"
              className="xl:col-span-4 space-y-3 min-w-0"
            >
              {loading ? (
                <div className="rounded-[24px] bg-white p-6 text-center text-[14px] text-[#5E5E5A] ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)]">
                  Loading campus operations...
                </div>
              ) : boardItems.length === 0 ? (
                <div className="rounded-[24px] bg-white p-6 text-center space-y-1.5 ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)]">
                  <p className="text-[15px] font-semibold text-black">
                    All clear here
                  </p>
                  <p className="text-[13.5px] text-[#5E5E5A]">
                    {tab === "ALERTS"
                      ? "Every campus SKU is healthy, visible, and above threshold."
                      : tab === "TICKETS"
                        ? "No campus equipment tickets right now."
                        : "No incoming stock dispatches recorded yet."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3">
                    {visibleItems.map((item, idx) => {
                      const palette = FLOW_PALETTES[idx % FLOW_PALETTES.length];
                      const active = isSelected(item.id);
                      const invThumb = item.inventory
                        ? getPartImageUrl(
                            item.inventory.item.code,
                            item.inventory.item.category.slug
                          )
                        : null;
                      const ticketDot = item.ticket
                        ? PRIORITY_DOT_CLASS[item.ticket.priority]
                        : null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => handleSelect(item.id, e)}
                          title="Click to inspect, Ctrl+Click to compare multiple"
                          style={
                            active
                              ? { backgroundColor: palette.banner }
                              : undefined
                          }
                          className={`w-full min-w-0 rounded-[24px] p-4 text-left transition-all cursor-pointer ${
                            active
                              ? "ring-2 ring-black/80 shadow-[0_12px_28px_rgba(0,0,0,0.09)]"
                              : "bg-white ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] hover:ring-black/15"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {invThumb && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={invThumb}
                                alt={item.title}
                                className="h-11 w-12 shrink-0 rounded-[12px] bg-[#F5F5F2] object-cover ring-1 ring-black/[0.06]"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-[14.5px] font-semibold tracking-[-0.015em] text-black">
                                  {item.title}
                                </p>
                                {ticketDot && (
                                  <span
                                    title={`${TICKET_PRIORITY_LABELS[item.ticket!.priority]} priority`}
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${ticketDot}`}
                                  />
                                )}
                              </div>
                              <p className="mt-1 text-[13.5px] text-black/70 line-clamp-2">
                                {item.subtitle}
                              </p>
                              <div className="mt-2.5 flex items-center justify-between gap-2 text-[13px] font-medium text-black/65">
                                <span className="capitalize truncate">
                                  {item.statusLabel}
                                </span>
                                {item.ticket && (
                                  <span className="shrink-0 text-black/55 truncate max-w-[140px]">
                                    {item.ticket.createdBy.fullName}
                                  </span>
                                )}
                                {item.inventory && (
                                  <span className="shrink-0 tabular-nums text-black/75">
                                    {item.inventory.availableQuantity} avail
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-black/[0.05] shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F2F2EE] disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        aria-label="Next page"
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F2F2EE] disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Multi-Pin Workspace */}
            <div
              data-canvas-controls="true"
              className={`xl:col-span-8 min-w-0 grid gap-5 ${
                isMultiMode ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="relative min-w-0 rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.045)] space-y-5"
                >
                  {isMultiMode && (
                    <button
                      type="button"
                      onClick={() => unpin(item.id)}
                      aria-label={`Unpin ${item.title}`}
                      className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F2] text-black transition-colors hover:bg-black hover:text-[#C4F041] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* TAB 1: INCOMING STOCK ALLOCATION DETAIL */}
                  {item.allocation && (() => {
                    const alloc = item.allocation;
                    const totalAllocated = alloc.items.reduce(
                      (s, it) => s + it.allocatedQuantity,
                      0
                    );
                    const totalReceived = alloc.items.reduce(
                      (s, it) => s + it.receivedQuantity,
                      0
                    );
                    const pending = isPendingAllocation(alloc);

                    return (
                      <>
                        <div className="pr-8 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium text-[#5E5E5A]">
                              {alloc.referenceCode}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-medium capitalize ${
                                pending
                                  ? "bg-[#F3FBD4] text-black"
                                  : alloc.status === "DISCREPANCY_REPORTED"
                                    ? "bg-[#FCEAE3] text-black"
                                    : "bg-[#F5F5F2] text-[#5E5E5A]"
                              }`}
                            >
                              {item.statusLabel}
                            </span>
                          </div>
                          <h2 className="text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-black">
                            {alloc.notes || "Incoming Stock Dispatch"}
                          </h2>
                          <p className="text-[14px] text-[#5E5E5A]">
                            From {alloc.source} · {alloc.destinationCampus.name}
                            {alloc.dispatchedAt
                              ? ` · Dispatched ${formatDate(alloc.dispatchedAt)}`
                              : ""}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Allocated Units
                            </p>
                            <p className="mt-1 text-[22px] font-semibold text-black tabular-nums">
                              {totalAllocated}
                            </p>
                          </div>
                          <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Received Units
                            </p>
                            <p className="mt-1 text-[22px] font-semibold text-black tabular-nums">
                              {totalReceived}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {alloc.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#F5F5F2] p-3"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getPartImageUrl(it.item.code)}
                                  alt={it.item.name}
                                  className="h-12 w-14 shrink-0 rounded-[12px] bg-white object-cover ring-1 ring-black/[0.05]"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[14.5px] font-semibold text-black">
                                    {it.item.name}
                                  </p>
                                  <p className="text-[13px] text-[#5E5E5A] tabular-nums">
                                    {it.item.code} · Allocated{" "}
                                    {it.allocatedQuantity} · Received{" "}
                                    {it.receivedQuantity}
                                    {it.damagedQuantity > 0
                                      ? ` · ${it.damagedQuantity} damaged`
                                      : ""}
                                    {it.missingQuantity > 0
                                      ? ` · ${it.missingQuantity} missing`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-medium text-black ring-1 ring-black/[0.06]">
                                {it.isVerified ? "Verified" : "Pending"}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <Link
                            href="/lab-manager/incoming-stock"
                            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#C4F041] px-5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041]"
                          >
                            Verify Dispatch
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          {alloc.verifiedBy && (
                            <span className="text-[13px] text-[#5E5E5A]">
                              Verified by {alloc.verifiedBy.fullName}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* TAB 2: ISSUE TICKET DETAIL WITH INLINE STATUS ACTIONS */}
                  {item.ticket && (() => {
                    const ticket = item.ticket;
                    const busy = busyTicketId === ticket.id;
                    const open = isOpenTicket(ticket);
                    const canStart =
                      ticket.status === "OPEN" ||
                      ticket.status === "ASSIGNED" ||
                      ticket.status === "REOPENED";

                    return (
                      <>
                        <div className="pr-8 space-y-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-[13px] font-medium text-[#5E5E5A]">
                              {ticket.ticketCode}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F2] px-3 py-0.5 text-[13px] font-medium text-black">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_CLASS[ticket.priority]}`}
                              />
                              {TICKET_PRIORITY_LABELS[ticket.priority]} priority
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-medium capitalize ${
                                open
                                  ? "bg-[#FDF1E0] text-black"
                                  : "bg-[#F3FBD4] text-black"
                              }`}
                            >
                              {item.statusLabel}
                            </span>
                          </div>

                          <h2 className="text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-black">
                            {ticket.title}
                          </h2>
                          <p className="text-[14px] leading-relaxed text-[#5E5E5A]">
                            {ticket.description}
                          </p>
                        </div>

                        {ticket.item && (
                          <div className="flex items-center gap-3.5 rounded-[18px] bg-[#F5F5F2] p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPartImageUrl(ticket.item.code)}
                              alt={ticket.item.name}
                              className="h-14 w-16 shrink-0 rounded-[12px] bg-white object-cover ring-1 ring-black/[0.05]"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[14.5px] font-semibold text-black">
                                {ticket.item.name}
                              </p>
                              <p className="text-[13px] text-[#5E5E5A]">
                                {ticket.item.code} ·{" "}
                                {ISSUE_CATEGORY_LABELS[ticket.category]}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-[#F5F5F2] px-4 py-3 text-[13.5px]">
                          <span className="text-[#5E5E5A]">
                            Reported by{" "}
                            <strong className="font-semibold text-black">
                              {ticket.createdBy.fullName}
                            </strong>
                          </span>
                          <span className="text-[#5E5E5A]">
                            Updated {formatRelativeTime(ticket.updatedAt)}
                          </span>
                        </div>

                        {/* Inline Quick Ticket Status Actions */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          {canStart && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleQuickTicketStatus(
                                  ticket,
                                  "IN_PROGRESS"
                                )
                              }
                              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-black px-4 text-[14px] font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 cursor-pointer"
                            >
                              <Play className="h-4 w-4" />
                              Start Progress
                            </button>
                          )}

                          {open ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleQuickTicketStatus(ticket, "RESOLVED")
                              }
                              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#C4F041] px-5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark Resolved
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleQuickTicketStatus(ticket, "REOPENED")
                              }
                              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#F5F5F2] px-4 text-[14px] font-medium text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 cursor-pointer"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Reopen
                            </button>
                          )}

                          <Link
                            href="/lab-manager/tickets"
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-[#5E5E5A] transition-colors hover:text-black"
                          >
                            All Tickets
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </>
                    );
                  })()}

                  {/* TAB 3: LOW STOCK & ALERTS DETAIL WITH INLINE CONTROLS */}
                  {item.inventory && (() => {
                    const inv = item.inventory;
                    const busy = busyInvId === inv.id;
                    const tags = getAlertTags(inv);
                    const labBlock = getLabBlock(inv);

                    return (
                      <>
                        <div className="flex items-start gap-4 pr-8 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getPartImageUrl(
                              inv.item.code,
                              inv.item.category.slug
                            )}
                            alt={inv.item.name}
                            className="h-20 w-24 sm:h-24 sm:w-28 shrink-0 rounded-[18px] bg-[#F5F5F2] object-cover ring-1 ring-black/[0.06]"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-[13px] text-[#5E5E5A] truncate">
                              {inv.item.code} · {inv.item.category.name}
                            </p>
                            <h2 className="text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-black leading-snug">
                              {inv.item.name}
                            </h2>
                            {labBlock && (
                              <p className="text-[13.5px] text-[#5E5E5A] truncate">
                                {labBlock}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full bg-[#FDF1E0] px-3 py-0.5 text-[13px] font-medium text-black"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Full Quantity Breakdown */}
                        <div
                          className={`grid gap-2.5 ${
                            isMultiMode
                              ? "grid-cols-2 sm:grid-cols-3"
                              : "grid-cols-2 sm:grid-cols-5"
                          }`}
                        >
                          <div className="rounded-[16px] bg-[#F5F5F2] p-3">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Available
                            </p>
                            <p className="mt-1 text-[20px] font-semibold text-black tabular-nums">
                              {inv.availableQuantity}
                            </p>
                          </div>
                          <div className="rounded-[16px] bg-[#F5F5F2] p-3">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Reserved
                            </p>
                            <p className="mt-1 text-[20px] font-semibold text-black tabular-nums">
                              {inv.reservedQuantity}
                            </p>
                          </div>
                          <div className="rounded-[16px] bg-[#F5F5F2] p-3">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Borrowed
                            </p>
                            <p className="mt-1 text-[20px] font-semibold text-black tabular-nums">
                              {inv.borrowedQuantity}
                            </p>
                          </div>
                          <div className="rounded-[16px] bg-[#F5F5F2] p-3">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Damaged
                            </p>
                            <p className="mt-1 text-[20px] font-semibold text-black tabular-nums">
                              {inv.damagedQuantity}
                            </p>
                          </div>
                          <div className="rounded-[16px] bg-[#F5F5F2] p-3">
                            <p className="text-[13px] text-[#5E5E5A]">
                              Missing
                            </p>
                            <p className="mt-1 text-[20px] font-semibold text-black tabular-nums">
                              {inv.missingQuantity}
                            </p>
                          </div>
                        </div>

                        {/* Inline Visibility Switch */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#F5F5F2] px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {inv.isVisible ? (
                              <Eye className="h-4 w-4 shrink-0 text-black" />
                            ) : (
                              <EyeOff className="h-4 w-4 shrink-0 text-[#5E5E5A]" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-black">
                                Student Catalog Visibility
                              </p>
                              <p className="text-[13px] text-[#5E5E5A]">
                                {inv.isVisible
                                  ? "Visible to instructors & students"
                                  : "Hidden from campus catalog"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={inv.isVisible}
                            disabled={busy}
                            aria-label={`Toggle visibility for ${inv.item.name}`}
                            onCheckedChange={(checked) =>
                              void handleQuickToggleVisibility(inv, checked)
                            }
                          />
                        </div>

                        {/* Inline Quick Restock + Inventory Link */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleQuickRestock(inv, 1)}
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#C4F041] px-4 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:opacity-50 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            Restock +1
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleQuickRestock(inv, 5)}
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-black px-4 text-[14px] font-semibold text-white transition-colors hover:bg-black/85 disabled:opacity-50 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            Restock +5
                          </button>
                          <Link
                            href="/lab-manager/inventory"
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-[#5E5E5A] transition-colors hover:text-black"
                          >
                            Manage Inventory
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DottedGridCanvas>
    </div>
  );
}
