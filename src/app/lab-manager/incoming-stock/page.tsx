"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Truck,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import {
  loadDemoAllocations,
  verifyDemoAllocation,
} from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import { formatDateTime } from "@/lib/utils";
import type {
  AllocationStatus,
  StockAllocationDTO,
  StockAllocationItemDTO,
} from "@/types/contracts";

type FilterTab = "PENDING" | "VERIFIED" | "DISCREPANCIES" | "ALL";
type VerificationDecision = "UNSET" | "MATCHED" | "DISCREPANCY";

interface RowVerifyState {
  allocationItemId: string;
  itemId: string;
  expected: number;
  receivedQuantity: number;
  missingQuantity: number;
  damagedQuantity: number;
  verificationNotes: string;
  decision: VerificationDecision;
  showNoteInput: boolean;
}

const FONT_STACK =
  "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif";

function isPendingAllocation(alloc: StockAllocationDTO): boolean {
  return alloc.status === "DISPATCHED" || alloc.status === "PARTIALLY_RECEIVED";
}

function getStatusPillMeta(status: AllocationStatus): {
  label: string;
  className: string;
  dotClassName: string;
} {
  switch (status) {
    case "DISPATCHED":
      return {
        label: "Awaiting Verification",
        className: "bg-[#E8F1FD] text-[#174EA6] ring-1 ring-[#174EA6]/15",
        dotClassName: "bg-[#1A73E8]",
      };
    case "PARTIALLY_RECEIVED":
      return {
        label: "Partially Verified",
        className: "bg-[#FEF4D6] text-[#7A5B14] ring-1 ring-[#B45309]/20",
        dotClassName: "bg-[#D97706]",
      };
    case "RECEIVED":
      return {
        label: "Verified & Published",
        className: "bg-[#E1F4E5] text-[#1D5C31] ring-1 ring-[#1D5C31]/15",
        dotClassName: "bg-[#228B44]",
      };
    case "DISCREPANCY_REPORTED":
      return {
        label: "Discrepancy Reported",
        className: "bg-[#FDE6DE] text-[#9A3412] ring-1 ring-[#D94E2A]/20",
        dotClassName: "bg-[#D94E2A]",
      };
    case "DRAFT":
      return {
        label: "Draft",
        className: "bg-[#F2F2EE] text-[#4A4A46] ring-1 ring-black/[0.08]",
        dotClassName: "bg-[#767670]",
      };
    case "CANCELLED":
    default:
      return {
        label: "Cancelled",
        className: "bg-[#F2F2EE] text-[#5E5E5A] ring-1 ring-black/[0.08]",
        dotClassName: "bg-[#8E8E88]",
      };
  }
}

interface QuantityStepperProps {
  label: string;
  value: number;
  max: number;
  tone: "received" | "missing" | "damaged";
  onChange: (next: number) => void;
}

function QuantityStepper({
  label,
  value,
  max,
  tone,
  onChange,
}: QuantityStepperProps) {
  const toneStyles = {
    received: {
      dot: "bg-[#228B44]",
      ring: value > 0 ? "ring-[#228B44]/25" : "ring-black/[0.06]",
    },
    missing: {
      dot: "bg-[#D97706]",
      ring: value > 0 ? "ring-[#D97706]/30" : "ring-black/[0.06]",
    },
    damaged: {
      dot: "bg-[#D94E2A]",
      ring: value > 0 ? "ring-[#D94E2A]/30" : "ring-black/[0.06]",
    },
  }[tone];

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + 1));
  };

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-[16px] bg-white px-3 py-2.5 ring-1 transition-colors ${toneStyles.ring}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${toneStyles.dot}`} />
        <span className="text-[13.5px] font-semibold text-black truncate">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= 0}
          aria-label={`Decrease ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F3EE] text-black transition-colors hover:bg-black hover:text-[#C4F041] active:scale-95 disabled:opacity-30 disabled:hover:bg-[#F3F3EE] disabled:hover:text-black cursor-pointer"
        >
          <Minus className="h-4 w-4 stroke-[2.25]" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          aria-label={`${label} quantity`}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            const clamped = Number.isNaN(parsed)
              ? 0
              : Math.max(0, Math.min(max, parsed));
            onChange(clamped);
          }}
          className="h-11 w-11 rounded-[10px] bg-transparent text-center text-[16px] sm:text-[15px] font-semibold text-black tabular-nums focus:bg-[#F5F5F2] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F3EE] text-black transition-colors hover:bg-black hover:text-[#C4F041] active:scale-95 disabled:opacity-30 disabled:hover:bg-[#F3F3EE] disabled:hover:text-black cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.25]" />
        </button>
      </div>
    </div>
  );
}

export default function LabManagerIncomingStockPage() {
  const { user, isDemoMode } = useAuth();
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDemoStore, setUsingDemoStore] = useState(false);
  const [rowsState, setRowsState] = useState<Record<string, RowVerifyState>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState<
    Record<string, boolean>
  >({});

  const [activeTab, setActiveTab] = useState<FilterTab>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Synchronize row verification state with loaded allocations.
   * CRITICAL DOMAIN RULE:
   * Unverified items ALWAYS initialize in explicit "UNSET" state with 0 received,
   * 0 missing, 0 damaged. Dispatched stock is NEVER auto-marked as received.
   */
  const syncVerificationState = useCallback((list: StockAllocationDTO[]) => {
    setRowsState((prev) => {
      const next: Record<string, RowVerifyState> = {};
      list.forEach((alloc) => {
        alloc.items.forEach((it) => {
          if (it.isVerified) {
            next[it.id] = {
              allocationItemId: it.id,
              itemId: it.itemId,
              expected: it.allocatedQuantity,
              receivedQuantity: it.receivedQuantity,
              missingQuantity: it.missingQuantity,
              damagedQuantity: it.damagedQuantity,
              verificationNotes: it.verificationNotes ?? "",
              decision:
                it.missingQuantity > 0 || it.damagedQuantity > 0
                  ? "DISCREPANCY"
                  : "MATCHED",
              showNoteInput: Boolean(it.verificationNotes),
            };
          } else if (prev[it.id]) {
            next[it.id] = {
              ...prev[it.id],
              expected: it.allocatedQuantity,
            };
          } else {
            next[it.id] = {
              allocationItemId: it.id,
              itemId: it.itemId,
              expected: it.allocatedQuantity,
              receivedQuantity: 0,
              missingQuantity: 0,
              damagedQuantity: 0,
              verificationNotes: "",
              decision: "UNSET",
              showNoteInput: false,
            };
          }
        });
      });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (isDemoMode) {
      const demo = loadDemoAllocations();
      setAllocations(demo);
      setUsingDemoStore(true);
      syncVerificationState(demo);
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.allocations.list({ pageSize: 50 });
      setAllocations(res.data);
      setUsingDemoStore(false);
      syncVerificationState(res.data);
    } catch {
      const demo = loadDemoAllocations();
      setAllocations(demo);
      setUsingDemoStore(true);
      syncVerificationState(demo);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, syncVerificationState]);

  useEffect(() => {
    void load();
  }, [load]);

  const { status: realtimeStatus } = useRealtime({
    enabled: true,
    isDemoMode: isDemoMode || usingDemoStore,
    eventTypes: ["allocation.created", "allocation.verified"],
    onEvent: () => {
      void load();
    },
    onReconnect: () => {
      void load();
    },
  });

  const updateRow = useCallback((id: string, patch: Partial<RowVerifyState>) => {
    setRowsState((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: { ...current, ...patch },
      };
    });
  }, []);

  const markExactMatch = useCallback(
    (id: string, expected: number) => {
      updateRow(id, {
        receivedQuantity: expected,
        missingQuantity: 0,
        damagedQuantity: 0,
        decision: "MATCHED",
      });
    },
    [updateRow]
  );

  const markDiscrepancy = useCallback(
    (id: string, expected: number) => {
      setRowsState((prev) => {
        const current = prev[id];
        if (!current) return prev;

        // If already in discrepancy with a non-zero shortage/damage split, preserve counts
        const keepExisting =
          current.decision === "DISCREPANCY" &&
          (current.missingQuantity > 0 || current.damagedQuantity > 0);

        const defaultReceived = Math.max(0, expected - 1);
        const defaultMissing = expected > 0 ? 1 : 0;

        return {
          ...prev,
          [id]: {
            ...current,
            receivedQuantity: keepExisting
              ? current.receivedQuantity
              : defaultReceived,
            missingQuantity: keepExisting
              ? current.missingQuantity
              : defaultMissing,
            damagedQuantity: keepExisting ? current.damagedQuantity : 0,
            decision: "DISCREPANCY",
            showNoteInput: true,
          },
        };
      });
    },
    []
  );

  const handleMarkAllExactMatch = useCallback((alloc: StockAllocationDTO) => {
    setRowsState((prev) => {
      const next = { ...prev };
      alloc.items.forEach((it) => {
        if (it.isVerified) return;
        const current = next[it.id];
        if (!current) return;
        next[it.id] = {
          ...current,
          receivedQuantity: it.allocatedQuantity,
          missingQuantity: 0,
          damagedQuantity: 0,
          decision: "MATCHED",
        };
      });
      return next;
    });
    toast.success(
      `Marked all unverified items in ${alloc.referenceCode} as Exact Match. Review and click Confirm & Publish.`
    );
  }, []);

  const handleResetAllocation = useCallback((alloc: StockAllocationDTO) => {
    setRowsState((prev) => {
      const next = { ...prev };
      alloc.items.forEach((it) => {
        if (it.isVerified) return;
        const current = next[it.id];
        if (!current) return;
        next[it.id] = {
          ...current,
          receivedQuantity: 0,
          missingQuantity: 0,
          damagedQuantity: 0,
          verificationNotes: "",
          decision: "UNSET",
          showNoteInput: false,
        };
      });
      return next;
    });
    setValidationAttempted((prev) => ({ ...prev, [alloc.id]: false }));
  }, []);

  const handleSubmitVerification = async (alloc: StockAllocationDTO) => {
    const unverifiedItems = alloc.items.filter((it) => !it.isVerified);
    if (unverifiedItems.length === 0) {
      toast.info(`${alloc.referenceCode} is already verified.`);
      return;
    }

    setValidationAttempted((prev) => ({ ...prev, [alloc.id]: true }));

    const rowEntries = unverifiedItems.map((it) => ({
      item: it,
      row: rowsState[it.id],
    }));

    const unsetItems = rowEntries.filter(
      ({ row }) => !row || row.decision === "UNSET"
    );
    if (unsetItems.length > 0) {
      toast.error(
        `${unsetItems.length} item${unsetItems.length === 1 ? "" : "s"} still awaiting verification. Choose Exact Match or Discrepancy for every row.`
      );
      return;
    }

    for (const { item, row } of rowEntries) {
      const total =
        row.receivedQuantity + row.missingQuantity + row.damagedQuantity;
      if (total !== row.expected) {
        toast.error(
          `${item.item.code}: Received (${row.receivedQuantity}) + Missing (${row.missingQuantity}) + Damaged (${row.damagedQuantity}) = ${total}, must equal ${row.expected} expected.`
        );
        return;
      }
    }

    const itemsPayload = rowEntries.map(({ row }) => ({
      allocationItemId: row.allocationItemId,
      itemId: row.itemId,
      receivedQuantity: row.receivedQuantity,
      missingQuantity: row.missingQuantity,
      damagedQuantity: row.damagedQuantity,
      verificationNotes: row.verificationNotes.trim() || undefined,
    }));

    const totalReceivedPublished = itemsPayload.reduce(
      (sum, item) => sum + item.receivedQuantity,
      0
    );
    const hasDiscrepancies = itemsPayload.some(
      (item) => item.missingQuantity > 0 || item.damagedQuantity > 0
    );

    const runDemoVerification = () => {
      const updatedList = verifyDemoAllocation(alloc.id, itemsPayload, user);
      setAllocations(updatedList);
      setUsingDemoStore(true);
      syncVerificationState(updatedList);
      setValidationAttempted((prev) => ({ ...prev, [alloc.id]: false }));
      toast.success(
        hasDiscrepancies
          ? `${alloc.referenceCode} verified with discrepancy report. ${totalReceivedPublished} good unit${totalReceivedPublished === 1 ? "" : "s"} published to campus inventory.`
          : `${alloc.referenceCode} verified cleanly. ${totalReceivedPublished} unit${totalReceivedPublished === 1 ? "" : "s"} published to campus inventory.`
      );
    };

    setSubmittingId(alloc.id);
    try {
      if (isDemoMode || usingDemoStore) {
        runDemoVerification();
        return;
      }

      const res = await apiClient.allocations.verify(alloc.id, {
        items: itemsPayload,
      });
      setAllocations((prev) => {
        const nextList = prev.map((a) => (a.id === alloc.id ? res.data : a));
        syncVerificationState(nextList);
        return nextList;
      });
      setValidationAttempted((prev) => ({ ...prev, [alloc.id]: false }));
      toast.success(
        hasDiscrepancies
          ? `${alloc.referenceCode} verified with discrepancy report. ${totalReceivedPublished} good unit${totalReceivedPublished === 1 ? "" : "s"} published to campus inventory.`
          : `${alloc.referenceCode} verified cleanly. ${totalReceivedPublished} unit${totalReceivedPublished === 1 ? "" : "s"} published to campus inventory.`
      );
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        runDemoVerification();
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to submit verification"
        );
      }
    } finally {
      setSubmittingId(null);
    }
  };

  // Telemetry & Filter Counts
  const counts = useMemo(() => {
    const pending = allocations.filter(isPendingAllocation);
    const verified = allocations.filter((a) => a.status === "RECEIVED");
    const discrepancies = allocations.filter(
      (a) => a.status === "DISCREPANCY_REPORTED"
    );

    const unitsInTransit = pending.reduce(
      (sum, alloc) =>
        sum +
        alloc.items.reduce(
          (itemSum, it) => itemSum + (it.isVerified ? 0 : it.allocatedQuantity),
          0
        ),
      0
    );

    const flaggedUnits = discrepancies.reduce(
      (sum, alloc) =>
        sum +
        alloc.items.reduce(
          (itemSum, it) => itemSum + it.missingQuantity + it.damagedQuantity,
          0
        ),
      0
    );

    return {
      pending: pending.length,
      verified: verified.length,
      discrepancies: discrepancies.length,
      all: allocations.length,
      unitsInTransit,
      flaggedUnits,
    };
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allocations.filter((alloc) => {
      if (activeTab === "PENDING" && !isPendingAllocation(alloc)) return false;
      if (activeTab === "VERIFIED" && alloc.status !== "RECEIVED") return false;
      if (
        activeTab === "DISCREPANCIES" &&
        alloc.status !== "DISCREPANCY_REPORTED"
      ) {
        return false;
      }

      if (!q) return true;
      const matchesHeader =
        alloc.referenceCode.toLowerCase().includes(q) ||
        alloc.source.toLowerCase().includes(q) ||
        (alloc.notes?.toLowerCase().includes(q) ?? false) ||
        alloc.destinationCampus.name.toLowerCase().includes(q) ||
        alloc.destinationCampus.code.toLowerCase().includes(q);

      if (matchesHeader) return true;
      return alloc.items.some(
        (it) =>
          it.item.name.toLowerCase().includes(q) ||
          it.item.code.toLowerCase().includes(q) ||
          (it.item.category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allocations, activeTab, searchQuery]);

  const filterTabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "PENDING", label: "Pending Verification", count: counts.pending },
    { id: "VERIFIED", label: "Verified", count: counts.verified },
    {
      id: "DISCREPANCIES",
      label: "Discrepancies",
      count: counts.discrepancies,
    },
    { id: "ALL", label: "All", count: counts.all },
  ];

  const renderLineItem = (
    alloc: StockAllocationDTO,
    it: StockAllocationItemDTO,
    isEditableDispatch: boolean
  ) => {
    const r = rowsState[it.id];
    const isVerifiedItem = it.isVerified || !isEditableDispatch;

    if (isVerifiedItem) {
      const itemHasIssue = it.missingQuantity > 0 || it.damagedQuantity > 0;
      return (
        <div
          key={it.id}
          className={`rounded-[20px] p-3.5 sm:p-4 ring-1 transition-colors ${
            itemHasIssue
              ? "bg-[#FFF6F2] ring-[#D94E2A]/25"
              : "bg-[#F5F9F4] ring-[#228B44]/20"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="h-14 w-16 sm:h-16 sm:w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-white p-1 ring-1 ring-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPartImageUrl(it.item.code)}
                  alt={it.item.name}
                  className="h-full w-full rounded-[10px] object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-black break-words">
                  {it.item.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[13px] font-medium text-black/80 ring-1 ring-black/[0.07]">
                    {it.item.code}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[13px] font-medium text-black/75 tabular-nums">
                    Allocated: {it.allocatedQuantity} {it.item.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F4E5] px-3 py-1 text-[13.5px] font-semibold text-[#1D5C31] tabular-nums">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                {it.receivedQuantity} Received
              </span>
              {it.missingQuantity > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF4D6] px-3 py-1 text-[13.5px] font-semibold text-[#7A5B14] tabular-nums">
                  {it.missingQuantity} Missing
                </span>
              )}
              {it.damagedQuantity > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE6DE] px-3 py-1 text-[13.5px] font-semibold text-[#9A3412] tabular-nums">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {it.damagedQuantity} Damaged
                </span>
              )}
            </div>
          </div>

          {it.verificationNotes && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] bg-white/85 px-3.5 py-2.5 text-[13.5px] text-[#4A4A46] ring-1 ring-black/[0.05]">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#5E5E5A]" />
              <p className="min-w-0 break-words leading-relaxed">
                {it.verificationNotes}
              </p>
            </div>
          )}
        </div>
      );
    }

    if (!r) return null;

    const accountedTotal =
      r.receivedQuantity + r.missingQuantity + r.damagedQuantity;
    const balanceDelta = accountedTotal - r.expected;
    const isBalanced = balanceDelta === 0;
    const isDiscrepancyMode = r.decision === "DISCREPANCY";
    const isMatchedMode = r.decision === "MATCHED";
    const isUnset = r.decision === "UNSET";
    const showUnsetWarning = Boolean(validationAttempted[alloc.id] && isUnset);
    const hasReportedIssue = r.missingQuantity > 0 || r.damagedQuantity > 0;

    const containerTone = showUnsetWarning
      ? "bg-[#FFF6F2] ring-[#D94E2A]/60"
      : isDiscrepancyMode
        ? isBalanced
          ? "bg-[#FFF7F3] ring-[#E5734E]/45"
          : "bg-[#FFF3F0] ring-[#D94E2A]/70"
        : isMatchedMode
          ? "bg-[#F3F8F2] ring-[#228B44]/35"
          : "bg-[#FAF9F6] ring-black/[0.06]";

    return (
      <div
        key={it.id}
        className={`rounded-[20px] p-3.5 sm:p-4 ring-1 transition-all ${containerTone}`}
      >
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Thumbnail Mat + Part Details */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            <div className="h-14 w-16 sm:h-16 sm:w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-white p-1 ring-1 ring-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPartImageUrl(it.item.code)}
                alt={it.item.name}
                className="h-full w-full rounded-[10px] object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[15.5px] font-semibold leading-snug text-black break-words">
                {it.item.name}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[13px] font-medium text-black/80 ring-1 ring-black/[0.07]">
                  {it.item.code}
                </span>
                <span className="inline-flex items-center rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[13px] font-semibold text-black tabular-nums">
                  Expected: {it.allocatedQuantity} {it.item.unit}
                </span>

                {isUnset && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
                      showUnsetWarning
                        ? "bg-[#FDE6DE] text-[#9A3412]"
                        : "bg-[#FEF4D6] text-[#7A5B14]"
                    }`}
                  >
                    {showUnsetWarning ? "Selection required" : "Awaiting check"}
                  </span>
                )}

                {isMatchedMode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E1F4E5] px-2.5 py-0.5 text-[13px] font-semibold text-[#1D5C31] tabular-nums">
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    {r.receivedQuantity} received
                  </span>
                )}

                {isDiscrepancyMode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE6DE] px-2.5 py-0.5 text-[13px] font-semibold text-[#9A3412] tabular-nums">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {accountedTotal}/{r.expected} accounted
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Explicit Verification Decision Controls */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => markExactMatch(it.id, it.allocatedQuantity)}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-all cursor-pointer ${
                isMatchedMode
                  ? "bg-black text-[#C4F041] shadow-[0_6px_18px_rgba(0,0,0,0.14)]"
                  : "bg-white text-black ring-1 ring-black/[0.1] hover:bg-[#EAF5E8] hover:ring-[#228B44]/35"
              }`}
            >
              <Check className="h-4 w-4 shrink-0 stroke-[2.5]" />
              <span>Exact Match</span>
            </button>

            <button
              type="button"
              onClick={() => markDiscrepancy(it.id, it.allocatedQuantity)}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-all cursor-pointer ${
                isDiscrepancyMode
                  ? "bg-[#D94E2A] text-white shadow-[0_6px_18px_rgba(217,78,42,0.25)]"
                  : "bg-white text-black ring-1 ring-black/[0.1] hover:bg-[#FDEAE3] hover:ring-[#D94E2A]/35"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Discrepancy</span>
            </button>
          </div>
        </div>

        {/* Discrepancy Steppers & Live Balance Check */}
        {isDiscrepancyMode && (
          <div className="mt-3.5 border-t border-black/[0.07] pt-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <QuantityStepper
                label="Received"
                value={r.receivedQuantity}
                max={r.expected}
                tone="received"
                onChange={(val) =>
                  updateRow(it.id, { receivedQuantity: val })
                }
              />
              <QuantityStepper
                label="Missing"
                value={r.missingQuantity}
                max={r.expected}
                tone="missing"
                onChange={(val) =>
                  updateRow(it.id, { missingQuantity: val })
                }
              />
              <QuantityStepper
                label="Damaged"
                value={r.damagedQuantity}
                max={r.expected}
                tone="damaged"
                onChange={(val) =>
                  updateRow(it.id, { damagedQuantity: val })
                }
              />
            </div>

            {/* Balance Validation Feedback Bar */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 rounded-[14px] px-3.5 py-2.5 text-[13.5px] font-medium ${
                isBalanced && hasReportedIssue
                  ? "bg-[#E1F4E5] text-[#1D5C31]"
                  : isBalanced && !hasReportedIssue
                    ? "bg-[#FEF4D6] text-[#7A5B14]"
                    : "bg-[#FDE6DE] text-[#9A3412]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isBalanced && hasReportedIssue ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="tabular-nums">
                  {isBalanced && hasReportedIssue
                    ? `Balanced: ${r.receivedQuantity} received + ${r.missingQuantity} missing + ${r.damagedQuantity} damaged = ${r.expected} expected.`
                    : isBalanced && !hasReportedIssue
                      ? `All ${r.expected} units marked Received — switch to Exact Match if there is no shortage or damage.`
                      : balanceDelta < 0
                        ? `${Math.abs(balanceDelta)} ${it.item.unit} unaccounted (${accountedTotal} / ${r.expected}). Distribute all units across Received, Missing, or Damaged.`
                        : `${balanceDelta} ${it.item.unit} over expected (${accountedTotal} / ${r.expected}). Reduce counts to match ${r.expected}.`}
                </span>
              </div>

              {isBalanced && !hasReportedIssue && (
                <button
                  type="button"
                  onClick={() => markExactMatch(it.id, it.allocatedQuantity)}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-black ring-1 ring-black/[0.1] hover:bg-black hover:text-[#C4F041] transition-colors cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Switch to Exact Match
                </button>
              )}
            </div>
          </div>
        )}

        {/* Optional Per-Item Verification Note */}
        {isDiscrepancyMode || r.showNoteInput ? (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor={`note-${it.id}`}
                className="text-[13px] font-medium text-[#5E5E5A]"
              >
                Verification note (optional)
              </label>
              {!isDiscrepancyMode && !r.verificationNotes.trim() && (
                <button
                  type="button"
                  onClick={() => updateRow(it.id, { showNoteInput: false })}
                  className="text-[13px] font-medium text-[#5E5E5A] hover:text-black cursor-pointer"
                >
                  Hide
                </button>
              )}
            </div>
            <input
              id={`note-${it.id}`}
              type="text"
              value={r.verificationNotes}
              onChange={(e) =>
                updateRow(it.id, { verificationNotes: e.target.value })
              }
              placeholder={
                isDiscrepancyMode
                  ? "Describe missing units, carton condition, or damage details..."
                  : "Optional seal condition, serial check, or shelf location note..."
              }
              className="min-h-[44px] w-full rounded-[14px] bg-white px-3.5 py-2 text-[16px] sm:text-[14px] text-black placeholder:text-[#8A8A84] ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-black/80"
            />
          </div>
        ) : (
          <div className="mt-2.5 flex items-center">
            <button
              type="button"
              onClick={() => updateRow(it.id, { showNoteInput: true })}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#5E5E5A] transition-colors hover:bg-black/[0.05] hover:text-black cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              Add note
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="w-full min-w-0 space-y-4"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* Top Page Title Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black">
            Incoming Stock Verification
          </h1>
          <p className="mt-1 text-[14px] sm:text-[14.5px] text-[#5E5E5A]">
            Verify every dispatched item line-by-line before publishing stock to
            campus inventory. Nothing is auto-marked as received.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-medium text-[#4A4A46] ring-1 ring-black/[0.07]">
            <Radio
              className={`h-3.5 w-3.5 ${
                realtimeStatus === "connected"
                  ? "text-[#228B44]"
                  : realtimeStatus === "demo"
                    ? "text-[#5E5E5A]"
                    : "text-[#D97706]"
              }`}
            />
            {realtimeStatus === "connected"
              ? "Live sync active"
              : realtimeStatus === "demo"
                ? "Demo sync active"
                : "Reconnecting..."}
          </span>

          <Link
            href="/lab-manager/inventory"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-black ring-1 ring-black/[0.08] shadow-[0_4px_14px_rgba(0,0,0,0.04)] transition-colors hover:bg-black hover:text-[#C4F041]"
          >
            <span>Campus Inventory</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Dotted-Grid Gallery Workbench */}
      <DottedGridCanvas pannable={false} className="p-3.5 sm:p-6">
        <div className="flex flex-col gap-5 min-w-0">
          {/* Summary Telemetry Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className={`group rounded-[24px] sm:rounded-[26px] bg-white p-4 sm:p-5 text-left ring-1 transition-all shadow-[0_8px_28px_rgba(0,0,0,0.045)] cursor-pointer ${
                activeTab === "PENDING"
                  ? "ring-black/80"
                  : "ring-black/[0.05] hover:ring-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Awaiting Verification
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C4F041] text-black">
                  <ClipboardCheck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-[-0.03em] text-black tabular-nums">
                {counts.pending}
              </p>
              <p className="mt-1 text-[13px] text-[#5E5E5A] truncate">
                {counts.pending === 0
                  ? "All dispatches checked"
                  : `Batch${counts.pending === 1 ? "" : "es"} ready to inspect`}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className="group rounded-[24px] sm:rounded-[26px] bg-white p-4 sm:p-5 text-left ring-1 ring-black/[0.05] hover:ring-black/20 transition-all shadow-[0_8px_28px_rgba(0,0,0,0.045)] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Units In Transit
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F1FD] text-[#174EA6]">
                  <Truck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-[-0.03em] text-black tabular-nums">
                {counts.unitsInTransit}
              </p>
              <p className="mt-1 text-[13px] text-[#5E5E5A] truncate">
                Pending physical count
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("VERIFIED")}
              className={`group rounded-[24px] sm:rounded-[26px] bg-white p-4 sm:p-5 text-left ring-1 transition-all shadow-[0_8px_28px_rgba(0,0,0,0.045)] cursor-pointer ${
                activeTab === "VERIFIED"
                  ? "ring-black/80"
                  : "ring-black/[0.05] hover:ring-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Verified Dispatches
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E1F4E5] text-[#1D5C31]">
                  <PackageCheck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-[-0.03em] text-black tabular-nums">
                {counts.verified}
              </p>
              <p className="mt-1 text-[13px] text-[#5E5E5A] truncate">
                Exact receipts published
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("DISCREPANCIES")}
              className={`group rounded-[24px] sm:rounded-[26px] bg-white p-4 sm:p-5 text-left ring-1 transition-all shadow-[0_8px_28px_rgba(0,0,0,0.045)] cursor-pointer ${
                activeTab === "DISCREPANCIES"
                  ? "ring-black/80"
                  : "ring-black/[0.05] hover:ring-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] sm:text-[13.5px] font-medium text-[#5E5E5A]">
                  Reported Discrepancies
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDE6DE] text-[#9A3412]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-[-0.03em] text-black tabular-nums">
                {counts.discrepancies}
              </p>
              <p className="mt-1 text-[13px] text-[#5E5E5A] truncate tabular-nums">
                {counts.flaggedUnits > 0
                  ? `${counts.flaggedUnits} unit${counts.flaggedUnits === 1 ? "" : "s"} missing or damaged`
                  : "Zero units flagged"}
              </p>
            </button>
          </div>

          {/* Filter Pills + Search Toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
            <div
              role="tablist"
              aria-label="Filter incoming dispatches"
              className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1"
            >
              {filterTabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                        : "bg-white/95 text-black ring-1 ring-black/[0.06] hover:bg-white"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`tabular-nums font-semibold ${
                        isActive ? "text-[#C4F041]" : "text-[#5E5E5A]"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-[320px] shrink-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B66]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search batch code, part, or SKU..."
                aria-label="Search dispatches"
                className="min-h-[44px] w-full rounded-full bg-white pl-11 pr-10 text-[16px] sm:text-[14px] text-black placeholder:text-[#767670] ring-1 ring-black/[0.07] shadow-[0_4px_16px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-black/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#5E5E5A] hover:bg-[#F2F2EE] hover:text-black cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dispatch Cards Workspace */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className="rounded-[24px] sm:rounded-[28px] bg-white p-6 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] animate-pulse space-y-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="h-7 w-36 rounded-full bg-[#EFEFE9]" />
                    <div className="h-7 w-40 rounded-full bg-[#F5F5F2]" />
                  </div>
                  <div className="h-6 w-2/3 rounded-full bg-[#F2F2EE]" />
                  <div className="space-y-3">
                    <div className="h-24 w-full rounded-[20px] bg-[#FAF9F6]" />
                    <div className="h-24 w-full rounded-[20px] bg-[#FAF9F6]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div className="rounded-[24px] sm:rounded-[28px] bg-white p-8 sm:p-12 text-center ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F2F2EE] text-black">
                {activeTab === "PENDING" && !searchQuery ? (
                  <PackageCheck className="h-7 w-7" />
                ) : (
                  <Package className="h-7 w-7" />
                )}
              </div>
              <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-black">
                {searchQuery
                  ? "No matching dispatches found"
                  : activeTab === "PENDING"
                    ? "All incoming dispatches verified"
                    : activeTab === "VERIFIED"
                      ? "No exact-match receipts yet"
                      : activeTab === "DISCREPANCIES"
                        ? "No reported discrepancies"
                        : "No incoming stock dispatches yet"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-[#5E5E5A]">
                {searchQuery
                  ? `No batches or SKUs matched "${searchQuery}". Try clearing the search filter.`
                  : activeTab === "PENDING"
                    ? "When Central Warehouse dispatches new lab hardware to your campus, it will appear here for line-by-line inspection."
                    : "Verified batches and discrepancy reports will be archived here for audit traceability."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-black px-5 text-[14px] font-semibold text-[#C4F041] cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
                {activeTab !== "ALL" && counts.all > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("ALL")}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#F2F2EE] px-5 text-[14px] font-semibold text-black hover:bg-[#C4F041] transition-colors cursor-pointer"
                  >
                    View all dispatches ({counts.all})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredAllocations.map((alloc) => {
                const isEditable = isPendingAllocation(alloc);
                const statusMeta = getStatusPillMeta(alloc.status);
                const totalAllocatedUnits = alloc.items.reduce(
                  (sum, it) => sum + it.allocatedQuantity,
                  0
                );

                const unverifiedItems = alloc.items.filter(
                  (it) => !it.isVerified
                );
                const decidedItems = unverifiedItems.filter(
                  (it) =>
                    rowsState[it.id] && rowsState[it.id].decision !== "UNSET"
                );
                const balancedItems = decidedItems.filter((it) => {
                  const r = rowsState[it.id];
                  return (
                    r.receivedQuantity +
                      r.missingQuantity +
                      r.damagedQuantity ===
                    r.expected
                  );
                });

                const remainingUnsetCount =
                  unverifiedItems.length - decidedItems.length;
                const unbalancedCount =
                  decidedItems.length - balancedItems.length;
                const allReady =
                  unverifiedItems.length > 0 &&
                  remainingUnsetCount === 0 &&
                  unbalancedCount === 0;
                const hasAnyDraftTouch = decidedItems.length > 0;
                const isSubmitting = submittingId === alloc.id;

                const draftReceivedSum = unverifiedItems.reduce(
                  (sum, it) => sum + (rowsState[it.id]?.receivedQuantity ?? 0),
                  0
                );
                const draftMissingSum = unverifiedItems.reduce(
                  (sum, it) => sum + (rowsState[it.id]?.missingQuantity ?? 0),
                  0
                );
                const draftDamagedSum = unverifiedItems.reduce(
                  (sum, it) => sum + (rowsState[it.id]?.damagedQuantity ?? 0),
                  0
                );

                return (
                  <section
                    key={alloc.id}
                    className="overflow-hidden rounded-[24px] sm:rounded-[28px] bg-white ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]"
                  >
                    {/* Dispatch Card Header */}
                    <div className="border-b border-black/[0.06] bg-[#FAF9F6] p-4 sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3.5 py-1 text-[13.5px] font-semibold ${
                                isEditable
                                  ? "bg-[#C4F041] text-black"
                                  : "bg-white text-black ring-1 ring-black/[0.08]"
                              }`}
                            >
                              {alloc.referenceCode}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${statusMeta.className}`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${statusMeta.dotClassName}`}
                              />
                              {statusMeta.label}
                            </span>

                            {isEditable && (
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold tabular-nums ${
                                  allReady
                                    ? "bg-[#E1F4E5] text-[#1D5C31]"
                                    : "bg-white text-[#4A4A46] ring-1 ring-black/[0.07]"
                                }`}
                              >
                                {decidedItems.length} / {unverifiedItems.length}{" "}
                                checked
                              </span>
                            )}
                          </div>

                          <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-black break-words">
                            {alloc.notes || "Incoming Stock Dispatch"}
                          </h2>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-[#5E5E5A]">
                            <span>From {alloc.source}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {alloc.destinationCampus.code} ·{" "}
                              {alloc.destinationCampus.name}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {alloc.items.length} SKU
                              {alloc.items.length === 1 ? "" : "s"} ·{" "}
                              {totalAllocatedUnits} units
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {alloc.verifiedAt
                                ? `Verified ${formatDateTime(alloc.verifiedAt)}${
                                    alloc.verifiedBy
                                      ? ` by ${alloc.verifiedBy.fullName}`
                                      : ""
                                  }`
                                : `Dispatched ${formatDateTime(
                                    alloc.dispatchedAt ?? alloc.createdAt
                                  )}`}
                            </span>
                          </div>
                        </div>

                        {/* Bulk Quick-Verify Shortcut (Explicit User Action Only) */}
                        {isEditable && unverifiedItems.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMarkAllExactMatch(alloc)}
                              className="inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-black ring-1 ring-black/[0.1] transition-colors hover:bg-black hover:text-[#C4F041] cursor-pointer"
                            >
                              <CheckCheck className="h-4 w-4 shrink-0" />
                              <span>Mark All Exact Match</span>
                            </button>

                            {hasAnyDraftTouch && (
                              <button
                                type="button"
                                onClick={() => handleResetAllocation(alloc)}
                                aria-label={`Reset verification for ${alloc.referenceCode}`}
                                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-medium text-[#5E5E5A] ring-1 ring-black/[0.08] transition-colors hover:text-black cursor-pointer"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Line Items Gallery */}
                    <div className="p-4 sm:p-6 space-y-3.5">
                      {alloc.items.map((it) =>
                        renderLineItem(alloc, it, isEditable)
                      )}
                    </div>

                    {/* Dispatch Card Verification Footer */}
                    {isEditable && unverifiedItems.length > 0 && (
                      <div className="border-t border-black/[0.06] bg-[#FAF9F6] p-4 sm:p-6 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-[14px] text-[#4A4A46]">
                          {allReady ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D5C31]">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Ready to publish:
                              </span>
                              <span className="font-semibold text-black">
                                {draftReceivedSum} to inventory
                              </span>
                              {draftMissingSum > 0 && (
                                <span className="font-semibold text-[#7A5B14]">
                                  · {draftMissingSum} missing
                                </span>
                              )}
                              {draftDamagedSum > 0 && (
                                <span className="font-semibold text-[#9A3412]">
                                  · {draftDamagedSum} damaged
                                </span>
                              )}
                            </div>
                          ) : unbalancedCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#9A3412]">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {unbalancedCount} item
                              {unbalancedCount === 1 ? "" : "s"} must balance to
                              expected quantity before publishing.
                            </span>
                          ) : (
                            <span className="tabular-nums">
                              <strong className="font-semibold text-black">
                                {remainingUnsetCount}
                              </strong>{" "}
                              item{remainingUnsetCount === 1 ? "" : "s"} still
                              need explicit verification (Exact Match or
                              Discrepancy).
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSubmitVerification(alloc)}
                          disabled={isSubmitting}
                          className={`inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14.5px] font-semibold transition-all cursor-pointer disabled:opacity-55 ${
                            allReady
                              ? "bg-[#C4F041] text-black shadow-[0_8px_22px_rgba(196,240,65,0.4)] hover:bg-black hover:text-[#C4F041]"
                              : "bg-[#C4F041]/70 text-black hover:bg-black hover:text-[#C4F041]"
                          }`}
                        >
                          <PackageCheck className="h-4 w-4 shrink-0" />
                          <span>
                            {isSubmitting
                              ? "Publishing to Inventory..."
                              : "Confirm & Publish to Inventory"}
                          </span>
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </DottedGridCanvas>
    </div>
  );
}
