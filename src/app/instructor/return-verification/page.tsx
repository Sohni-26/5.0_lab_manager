"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  MessageSquareText,
  Minus,
  Package,
  PackageX,
  Plus,
  RotateCcw,
  ShieldAlert,
  User,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { PhotoComparisonGrid } from "@/components/shared/photo-comparison-grid";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  readMergedDemoRequests,
  upsertLocalStudentRequest,
} from "@/lib/student-requests-store";
import { cn, formatDateTime } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type ReturnCondition,
  type ReturnVerificationDTO,
} from "@/types/contracts";

interface VerifyFormState {
  condition: ReturnCondition;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  instructorRemarks: string;
}

const PENDING_RETURN_STATUSES = new Set<LabRequestDTO["status"]>([
  "RETURN_VERIFICATION_PENDING",
  "RETURN_SUBMITTED",
  "RETURN_DISPUTED",
  "PARTIALLY_RETURNED",
]);

const CONDITION_OPTIONS: Array<{
  value: "GOOD" | "DAMAGED" | "MISSING";
  label: string;
  shortLabel: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
  badgeClass: string;
}> = [
  {
    value: "GOOD",
    label: "Verify Good",
    shortLabel: "Good",
    helper: "Restores verified units to available lab stock and closes the return.",
    icon: CheckCircle2,
    activeClass:
      "border-2 border-black bg-[#C4F041] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    badgeClass: "border-black/20 bg-[#F3FBD4] text-[#2F5437]",
  },
  {
    value: "DAMAGED",
    label: "Report Damage",
    shortLabel: "Damage",
    helper: "Marks request disputed and logs damaged units with your remarks.",
    icon: AlertTriangle,
    activeClass:
      "border-2 border-black bg-[#F3BD77] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    badgeClass: "border-black/20 bg-[#FBF0DC] text-[#8C5811]",
  },
  {
    value: "MISSING",
    label: "Report Missing",
    shortLabel: "Missing",
    helper: "Marks request disputed and flags unaccounted units for follow-up.",
    icon: PackageX,
    activeClass:
      "border-2 border-black bg-[#FA8E66] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    badgeClass: "border-black/20 bg-[#FDE5DC] text-[#B33C17]",
  },
];

function getItemPhotos(
  req: LabRequestDTO,
  it: LabRequestItemDTO
): ItemPhotoDTO[] {
  const seen = new Set<string>();
  const merged: ItemPhotoDTO[] = [];
  for (const photo of [
    ...(it.photos ?? []),
    ...(req.photos ?? []).filter((p) => p.requestItemId === it.id),
  ]) {
    if (!seen.has(photo.id)) {
      seen.add(photo.id);
      merged.push(photo);
    }
  }
  return merged;
}

function countPhasePhotos(
  photos: ItemPhotoDTO[],
  phase: "COLLECTION" | "RETURN"
): number {
  const angles = new Set(
    photos.filter((p) => p.phase === phase).map((p) => p.angle)
  );
  return REQUIRED_PHOTO_ANGLES.filter((a) => angles.has(a)).length;
}

function getRequestStatusMeta(status: LabRequestDTO["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "RETURN_DISPUTED":
      return {
        label: "Disputed",
        className: "border-black/15 bg-[#FDE5DC] text-[#B33C17]",
      };
    case "PARTIALLY_RETURNED":
      return {
        label: "Partially Returned",
        className: "border-black/15 bg-[#FBF0DC] text-[#8C5811]",
      };
    case "RETURN_SUBMITTED":
      return {
        label: "Return Submitted",
        className: "border-black/15 bg-[#E8F4FD] text-[#1D5570]",
      };
    default:
      return {
        label: "Awaiting Inspection",
        className: "border-black/15 bg-[#E8F4FD] text-[#1D5570]",
      };
  }
}

interface QuantityStepperProps {
  id: string;
  label: string;
  value: number;
  max: number;
  accent?: "good" | "damaged" | "missing";
  onChange: (next: number) => void;
}

function QuantityStepper({
  id,
  label,
  value,
  max,
  accent = "good",
  onChange,
}: QuantityStepperProps) {
  const clamp = (n: number) =>
    Math.max(0, Math.min(max, Number.isFinite(n) ? Math.floor(n) : 0));

  const ringClass =
    accent === "damaged"
      ? "focus:ring-[#F3BD77]"
      : accent === "missing"
        ? "focus:ring-[#FA8E66]"
        : "focus:ring-[#C4F041]";

  const hoverBtnClass =
    accent === "damaged"
      ? "hover:bg-[#F3BD77]"
      : accent === "missing"
        ? "hover:bg-[#FA8E66]"
        : "hover:bg-[#C4F041]";

  return (
    <div className="space-y-2 rounded-[16px] border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[14px] font-semibold text-black leading-snug"
        >
          {label}
        </label>
        <span className="text-[13px] text-[#5E5E5A] tabular-nums shrink-0">
          0–{max}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - 1))}
          aria-label={`Decrease ${label}`}
          className={cn(
            "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/16 bg-[#F7F7F5] text-black transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-35",
            hoverBtnClass
          )}
        >
          <Minus className="h-4 w-4" />
        </button>

        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = e.target.value === "" ? 0 : Number(e.target.value);
            onChange(clamp(parsed));
          }}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-full border border-black/16 bg-white px-3 text-center text-[15px] font-semibold text-black tabular-nums focus:border-black focus:outline-none focus:ring-2",
            ringClass
          )}
        />

        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
          aria-label={`Increase ${label}`}
          className={cn(
            "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/16 bg-[#F7F7F5] text-black transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-35",
            hoverBtnClass
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function InstructorReturnVerificationPage() {
  const { user, isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, VerifyFormState>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const initFormsAndExpansion = useCallback((list: LabRequestDTO[]) => {
    const nextForms: Record<string, VerifyFormState> = {};
    const nextExpanded: Record<string, boolean> = {};

    list.forEach((req) => {
      req.items.forEach((it, idx) => {
        const issued = Math.max(0, it.issuedQuantity || 0);
        const remaining = Math.max(
          0,
          issued - it.returnedQuantity - it.damagedQuantity - it.missingQuantity
        );
        const defaultGood = Math.min(issued, remaining || issued || 1);
        const latestRv = it.borrowingRecords?.[0]?.returnVerifications?.[0];
        const presetCondition: ReturnCondition =
          req.status === "RETURN_DISPUTED" &&
          (latestRv?.condition === "DAMAGED" || latestRv?.condition === "MISSING")
            ? latestRv.condition
            : "GOOD";

        nextForms[it.id] = {
          condition: presetCondition,
          returnedQuantity:
            presetCondition === "GOOD"
              ? defaultGood
              : Math.min(issued, latestRv?.returnedQuantity ?? 0),
          damagedQuantity:
            presetCondition === "DAMAGED"
              ? Math.min(issued, latestRv?.damagedQuantity || defaultGood)
              : 0,
          missingQuantity:
            presetCondition === "MISSING"
              ? Math.min(issued, latestRv?.missingQuantity || defaultGood)
              : 0,
          instructorRemarks:
            req.status === "RETURN_DISPUTED"
              ? latestRv?.instructorRemarks ?? ""
              : "",
        };

        // Auto-expand the first item in every pending request for immediate inspection
        nextExpanded[it.id] = idx === 0;
      });
    });

    setForms((prev) => {
      const merged: Record<string, VerifyFormState> = {};
      for (const [id, initial] of Object.entries(nextForms)) {
        merged[id] = prev[id] ?? initial;
      }
      return merged;
    });

    setExpandedItems((prev) => {
      const merged: Record<string, boolean> = {};
      for (const [id, initial] of Object.entries(nextExpanded)) {
        merged[id] = prev[id] !== undefined ? prev[id] : initial;
      }
      return merged;
    });
  }, []);

  const loadFromDemoStore = useCallback(() => {
    const merged = readMergedDemoRequests(DEMO_REQUESTS);
    const pending = merged.filter((r) => PENDING_RETURN_STATUSES.has(r.status));
    setRequests(pending);
    initFormsAndExpansion(pending);
  }, [initFormsAndExpansion]);

  const load = useCallback(async () => {
    if (isDemoMode) {
      loadFromDemoStore();
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      const pending = res.data.filter((r) =>
        PENDING_RETURN_STATUSES.has(r.status)
      );
      setRequests(pending);
      initFormsAndExpansion(pending);
    } catch {
      loadFromDemoStore();
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, initFormsAndExpansion, loadFromDemoStore]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: [
      "return.submitted",
      "return.verified",
      "request.status_changed",
    ],
    onEvent: () => load(),
  });

  const updateItemForm = (itemId: string, patch: Partial<VerifyFormState>) => {
    setForms((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: { ...current, ...patch },
      };
    });
  };

  const setConditionPreset = (
    item: LabRequestItemDTO,
    condition: ReturnCondition
  ) => {
    const maxQty = Math.max(0, item.issuedQuantity);
    const rawOutstanding = Math.max(
      1,
      item.issuedQuantity -
        item.returnedQuantity -
        item.damagedQuantity -
        item.missingQuantity
    );
    const outstanding = maxQty > 0 ? Math.min(maxQty, rawOutstanding) : 0;

    if (condition === "GOOD") {
      updateItemForm(item.id, {
        condition: "GOOD",
        returnedQuantity: outstanding,
        damagedQuantity: 0,
        missingQuantity: 0,
      });
    } else if (condition === "DAMAGED") {
      updateItemForm(item.id, {
        condition: "DAMAGED",
        returnedQuantity: 0,
        damagedQuantity: outstanding,
        missingQuantity: 0,
      });
    } else if (condition === "MISSING") {
      updateItemForm(item.id, {
        condition: "MISSING",
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: outstanding,
      });
    }
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const openNextItem = (req: LabRequestDTO, currentItemId: string) => {
    const idx = req.items.findIndex((it) => it.id === currentItemId);
    if (idx < 0 || req.items.length <= 1) return;
    const nextItem = req.items[(idx + 1) % req.items.length];
    if (!nextItem) return;
    setExpandedItems((prev) => ({
      ...prev,
      [currentItemId]: false,
      [nextItem.id]: true,
    }));
  };

  const applyLocalDemoVerification = useCallback(
    (
      req: LabRequestDTO,
      payloadItems: Array<{
        borrowingRecordId?: string;
        requestItemId: string;
        returnVerificationId?: string;
        condition: ReturnCondition;
        returnedQuantity: number;
        damagedQuantity: number;
        missingQuantity: number;
        instructorRemarks?: string;
      }>
    ) => {
      const nowIso = new Date().toISOString();
      const byItemId = new Map(
        payloadItems.map((row) => [row.requestItemId, row])
      );

      const hasDiscrepancy = payloadItems.some(
        (row) =>
          row.condition === "DAMAGED" ||
          row.condition === "MISSING" ||
          row.damagedQuantity > 0 ||
          row.missingQuantity > 0
      );

      const nextStatus: LabRequestDTO["status"] = hasDiscrepancy
        ? "RETURN_DISPUTED"
        : "CLOSED";

      const verifier = user
        ? { id: user.id, fullName: user.fullName }
        : { id: req.instructor.id, fullName: req.instructor.fullName };

      const updatedItems: LabRequestItemDTO[] = req.items.map((it) => {
        const row = byItemId.get(it.id);
        if (!row) return it;

        const maxQty = Math.max(0, it.issuedQuantity);
        const nextReturned = Math.min(maxQty, Math.max(0, row.returnedQuantity));
        const nextDamaged = Math.min(maxQty, Math.max(0, row.damagedQuantity));
        const nextMissing = Math.min(maxQty, Math.max(0, row.missingQuantity));

        const rvStatus: ReturnVerificationDTO["status"] =
          row.condition === "DAMAGED" || nextDamaged > 0
            ? "DISPUTED_DAMAGED"
            : row.condition === "MISSING" || nextMissing > 0
              ? "DISPUTED_MISSING"
              : "VERIFIED_GOOD";

        const updatedRecords = it.borrowingRecords?.map((br, brIdx) => {
          if (brIdx !== 0) return br;
          const existingRvs = br.returnVerifications ?? [];
          const nextRvs: ReturnVerificationDTO[] =
            existingRvs.length > 0
              ? existingRvs.map((rv, rvIdx) =>
                  rvIdx === 0
                    ? {
                        ...rv,
                        verifiedById: verifier.id,
                        verifiedBy: verifier,
                        returnedQuantity: nextReturned,
                        damagedQuantity: nextDamaged,
                        missingQuantity: nextMissing,
                        condition: row.condition,
                        status: rvStatus,
                        instructorRemarks:
                          row.instructorRemarks ?? rv.instructorRemarks,
                        verifiedAt: nowIso,
                      }
                    : rv
                )
              : [
                  {
                    id: `rv-local-${Date.now()}-${it.id}`,
                    borrowingRecordId: br.id,
                    requestItemId: it.id,
                    verifiedById: verifier.id,
                    verifiedBy: verifier,
                    returnedQuantity: nextReturned,
                    damagedQuantity: nextDamaged,
                    missingQuantity: nextMissing,
                    condition: row.condition,
                    status: rvStatus,
                    studentComments: null,
                    instructorRemarks: row.instructorRemarks ?? null,
                    submittedAt: nowIso,
                    verifiedAt: nowIso,
                  },
                ];

          return {
            ...br,
            returnedQuantity: nextReturned,
            damagedQuantity: nextDamaged,
            missingQuantity: nextMissing,
            closedAt: hasDiscrepancy ? null : nowIso,
            returnVerifications: nextRvs,
          };
        });

        return {
          ...it,
          returnedQuantity: nextReturned,
          damagedQuantity: nextDamaged,
          missingQuantity: nextMissing,
          borrowingRecords: updatedRecords,
        };
      });

      const updatedRequest: LabRequestDTO = {
        ...req,
        status: nextStatus,
        updatedAt: nowIso,
        items: updatedItems,
      };

      upsertLocalStudentRequest(updatedRequest);
      loadFromDemoStore();

      toast.success(
        hasDiscrepancy
          ? `Dispute recorded for ${req.requestCode}. Marked as Return Disputed with remarks.`
          : `Return verified for ${req.requestCode}. Request closed and stock restored.`
      );
    },
    [user, loadFromDemoStore]
  );

  const handleVerifyRequest = async (req: LabRequestDTO) => {
    const payloadItems = req.items.map((it) => {
      const f = forms[it.id] ?? {
        condition: "GOOD" as ReturnCondition,
        returnedQuantity: Math.max(0, it.issuedQuantity),
        damagedQuantity: 0,
        missingQuantity: 0,
        instructorRemarks: "",
      };
      const latestBorrow = it.borrowingRecords?.[0];
      const latestRv = latestBorrow?.returnVerifications?.[0];
      return {
        borrowingRecordId: latestBorrow?.id,
        requestItemId: it.id,
        returnVerificationId: latestRv?.id,
        condition: f.condition,
        returnedQuantity: f.returnedQuantity,
        damagedQuantity: f.damagedQuantity,
        missingQuantity: f.missingQuantity,
        instructorRemarks: f.instructorRemarks.trim() || undefined,
      };
    });

    for (const row of payloadItems) {
      const needsRemarks =
        row.condition === "DAMAGED" ||
        row.condition === "MISSING" ||
        row.damagedQuantity > 0 ||
        row.missingQuantity > 0;
      if (
        needsRemarks &&
        (!row.instructorRemarks || row.instructorRemarks.length < 3)
      ) {
        setExpandedItems((prev) => ({
          ...prev,
          [row.requestItemId]: true,
        }));
        toast.error(
          "Please enter at least 3 characters of inspection remarks when reporting damage or missing items."
        );
        return;
      }
    }

    setSubmittingId(req.id);
    try {
      if (isDemoMode) {
        applyLocalDemoVerification(req, payloadItems);
        return;
      }

      await apiClient.requests.verifyReturn(req.id, { items: payloadItems });
      toast.success(
        `Return inspection saved for ${req.requestCode}. Inventory counts updated atomically.`
      );
      await load();
    } catch (err) {
      if (
        isDemoMode ||
        isBackendUnavailableError(err) ||
        req.id.startsWith("req-demo-") ||
        req.id.startsWith("req-local-")
      ) {
        applyLocalDemoVerification(req, payloadItems);
      } else {
        toast.error(err instanceof Error ? err.message : "Verification failed");
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const totalItemsToValidate = useMemo(
    () => requests.reduce((sum, req) => sum + req.items.length, 0),
    [requests]
  );

  return (
    <div
      className="space-y-4 sm:space-y-5 max-w-full overflow-x-hidden"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Clean Editorial Header */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Return Validation
          </h1>
          <p className="mt-1 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
            Compare 4-angle Collection vs. Return photos side-by-side before restoring equipment to stock or flagging damage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-black/14 bg-white px-4 text-[14px] text-[#5E5E5A]">
            <span className="h-2.5 w-2.5 rounded-full border border-black bg-[#C4F041]" />
            <span>Pending Inspections</span>
            <strong className="font-semibold text-black tabular-nums">
              {requests.length}
            </strong>
          </div>

          <div className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-black/14 bg-white px-4 text-[14px] text-[#5E5E5A]">
            <Package className="h-4 w-4 shrink-0 text-black/60" />
            <span>Items to Validate</span>
            <strong className="font-semibold text-black tabular-nums">
              {totalItemsToValidate}
            </strong>
          </div>

          <Link
            href="/instructor/requests"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-black/14 bg-white px-4 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
          >
            <span>Assigned Requests</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Cohesive NxtWave Light Dotted-Grid Validation Workbench */}
      <DottedGridCanvas pannable={false} className="flex flex-col p-4 sm:p-7">
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-8 text-center shadow-card">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-black/60" />
            <p className="mt-3 text-[15px] font-medium text-black">
              Loading pending return inspections...
            </p>
            <p className="mt-1 text-[14px] text-[#5E5E5A]">
              Fetching 4-angle photo proofs awaiting bench validation.
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="m-auto w-full max-w-[500px] rounded-[24px] sm:rounded-[28px] border border-black/14 bg-white p-6 sm:p-10 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-black/14 bg-[#F3FBD4] text-black">
              <RotateCcw className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
              All returns validated
            </h2>
            <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              No equipment returns are currently awaiting physical inspection. When students upload 4-angle return photos, they will appear here automatically.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <Link
                href="/instructor/requests"
                className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[14px] font-semibold text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#C4F041]"
              >
                <span>Open Assigned Requests</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/instructor/history"
                className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-black/18 bg-white px-5 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
              >
                <span>View Verification History</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {requests.map((req) => {
              const statusMeta = getRequestStatusMeta(req.status);
              const isSubmitting = submittingId === req.id;

              const flaggedCount = req.items.filter((it) => {
                const f = forms[it.id];
                if (!f) return false;
                return (
                  f.condition === "DAMAGED" ||
                  f.condition === "MISSING" ||
                  f.damagedQuantity > 0 ||
                  f.missingQuantity > 0
                );
              }).length;

              const missingRemarksCount = req.items.filter((it) => {
                const f = forms[it.id];
                if (!f) return false;
                const needs =
                  f.condition === "DAMAGED" ||
                  f.condition === "MISSING" ||
                  f.damagedQuantity > 0 ||
                  f.missingQuantity > 0;
                return needs && f.instructorRemarks.trim().length < 3;
              }).length;

              return (
                <section
                  key={req.id}
                  className="overflow-hidden rounded-[24px] border border-black/14 bg-white shadow-card"
                >
                  {/* Request Header */}
                  <div className="border-b border-black/10 bg-[#F7F7F5] p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-mono text-[16px] sm:text-[18px] font-semibold tracking-[-0.01em] text-black tabular-nums">
                            {req.requestCode}
                          </h2>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-medium",
                              statusMeta.className
                            )}
                          >
                            {statusMeta.label}
                          </span>
                        </div>

                        {req.purpose && (
                          <p className="text-[14px] sm:text-[15px] text-black/80 leading-snug">
                            {req.purpose}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-[#5E5E5A]">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-4 w-4 shrink-0 text-black/60" />
                            <span>
                              Student:{" "}
                              <strong className="font-semibold text-black">
                                {req.student.fullName}
                              </strong>{" "}
                              <span className="font-mono text-[13px]">
                                ({req.student.institutionalId})
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Package className="h-4 w-4 shrink-0 text-black/60" />
                            {req.items.length} item
                            {req.items.length === 1 ? "" : "s"}
                          </span>
                          <span className="tabular-nums">
                            Updated {formatDateTime(req.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex sm:items-center sm:gap-2 shrink-0">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums",
                            flaggedCount > 0
                              ? "border-black/20 bg-[#FBF0DC] text-[#8C5811]"
                              : "border-black/15 bg-[#F3FBD4] text-[#2F5437]"
                          )}
                        >
                          {flaggedCount > 0 ? (
                            <>
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {flaggedCount} flagged for dispute
                            </>
                          ) : (
                            <>
                              <ClipboardCheck className="h-4 w-4 shrink-0" />
                              All items set to Good
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Per-Item Inspection Cards */}
                  <div className="p-3.5 sm:p-6 space-y-4">
                    {req.items.map((it, itemIdx) => {
                      const f = forms[it.id];
                      const isExpanded = Boolean(expandedItems[it.id]);
                      const latestRv =
                        it.borrowingRecords?.[0]?.returnVerifications?.[0];
                      const itemPhotos = getItemPhotos(req, it);
                      const collectionCount = countPhasePhotos(
                        itemPhotos,
                        "COLLECTION"
                      );
                      const returnCount = countPhasePhotos(
                        itemPhotos,
                        "RETURN"
                      );
                      const partImg =
                        it.item.imageUrl || getPartImageUrl(it.item.code);
                      const maxQty = Math.max(0, it.issuedQuantity);
                      const currentCondition = f?.condition ?? "GOOD";
                      const conditionMeta =
                        CONDITION_OPTIONS.find(
                          (o) => o.value === currentCondition
                        ) ?? CONDITION_OPTIONS[0];
                      const requiresRemarks =
                        currentCondition === "DAMAGED" ||
                        currentCondition === "MISSING" ||
                        (f?.damagedQuantity ?? 0) > 0 ||
                        (f?.missingQuantity ?? 0) > 0;
                      const totalAccounted =
                        (f?.returnedQuantity ?? 0) +
                        (f?.damagedQuantity ?? 0) +
                        (f?.missingQuantity ?? 0);

                      return (
                        <div
                          key={it.id}
                          className={cn(
                            "overflow-hidden rounded-[20px] border transition-colors",
                            isExpanded
                              ? "border-black/25 bg-white shadow-xs"
                              : "border-black/12 bg-[#FAFAF8] hover:border-black/25"
                          )}
                        >
                          {/* Expandable Item Header */}
                          <button
                            type="button"
                            onClick={() => toggleItemExpanded(it.id)}
                            aria-expanded={isExpanded}
                            className="flex w-full min-h-[76px] cursor-pointer items-center gap-3 p-3.5 sm:p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
                          >
                            {/* Real WebP Hardware Photo */}
                            <div className="relative h-14 w-16 sm:h-16 sm:w-20 shrink-0 overflow-hidden rounded-[14px] border border-black/12 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={partImg}
                                alt={it.item.name}
                                className="h-full w-full object-cover"
                              />
                              <span
                                className={cn(
                                  "absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-black text-black",
                                  currentCondition === "GOOD"
                                    ? "bg-[#C4F041]"
                                    : currentCondition === "DAMAGED"
                                      ? "bg-[#F3BD77]"
                                      : "bg-[#FA8E66]"
                                )}
                              >
                                {currentCondition === "GOOD" ? (
                                  <Check className="h-3 w-3 stroke-[2.75]" />
                                ) : currentCondition === "DAMAGED" ? (
                                  <AlertTriangle className="h-3 w-3 stroke-[2.5]" />
                                ) : (
                                  <PackageX className="h-3 w-3 stroke-[2.5]" />
                                )}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="text-[15px] sm:text-[16px] font-semibold leading-snug tracking-[-0.01em] text-black break-words">
                                {it.item.name}
                              </h3>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-[#5E5E5A]">
                                <span className="font-mono tabular-nums">
                                  {it.item.code}
                                </span>
                                <span>·</span>
                                <span className="tabular-nums">
                                  Issued: {it.issuedQuantity} {it.item.unit}
                                </span>
                                <span className="hidden sm:inline">·</span>
                                <span className="hidden sm:inline tabular-nums">
                                  Photos: {collectionCount}/4 before ·{" "}
                                  {returnCount}/4 after
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold",
                                    conditionMeta.badgeClass
                                  )}
                                >
                                  {conditionMeta.label}
                                </span>
                                {latestRv?.studentComments && !isExpanded && (
                                  <span className="inline-flex items-center gap-1 text-[13px] text-[#1D5570] font-medium">
                                    <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                                    Student note attached
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/12 bg-white text-black transition-transform duration-200",
                                isExpanded && "rotate-180 bg-[#F2F2EF]"
                              )}
                            >
                              <ChevronDown className="h-4.5 w-4.5" />
                            </span>
                          </button>

                          {/* Expanded Inspection Body */}
                          {isExpanded && f && (
                            <div className="border-t border-black/10 bg-white p-3.5 sm:p-5 space-y-5">
                              {/* Student Return Note */}
                              {latestRv?.studentComments && (
                                <div className="rounded-[14px] bg-[#E8F4FD] border border-black/10 px-4 py-3 text-[14px] text-black">
                                  <div className="flex items-start gap-2.5">
                                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[#1D5570]" />
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-semibold text-[#1D5570]">
                                        Student Return Note
                                      </p>
                                      <p className="mt-0.5 leading-relaxed text-black break-words">
                                        &ldquo;{latestRv.studentComments}&rdquo;
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Prior Dispute Remarks (when re-inspecting a disputed return) */}
                              {req.status === "RETURN_DISPUTED" &&
                                latestRv?.instructorRemarks && (
                                  <div className="rounded-[14px] bg-[#FDE5DC] border border-black/10 px-4 py-3 text-[14px] text-black">
                                    <div className="flex items-start gap-2.5">
                                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B33C17]" />
                                      <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-[#B33C17]">
                                          Previous Dispute Remarks
                                        </p>
                                        <p className="mt-0.5 leading-relaxed text-black break-words">
                                          {latestRv.instructorRemarks}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                              {/* Side-by-Side 4-Angle Photo Comparison */}
                              <div className="space-y-3 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Camera className="h-4 w-4 shrink-0 text-black" />
                                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-black">
                                      4-Angle Photo Comparison
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium tabular-nums text-[#5E5E5A]">
                                    <span className="rounded-full border border-black/12 bg-[#F7F7F5] px-3 py-0.5 text-black">
                                      Collection {collectionCount}/4
                                    </span>
                                    <span className="rounded-full border border-black/12 bg-[#E8F4FD] px-3 py-0.5 text-[#1D5570]">
                                      Return {returnCount}/4
                                    </span>
                                  </div>
                                </div>

                                <div className="min-w-0 max-w-full overflow-hidden">
                                  <PhotoComparisonGrid
                                    photos={itemPhotos}
                                    itemName={it.item.name}
                                  />
                                </div>
                              </div>

                              {/* Thumb-Friendly Validation Controls */}
                              <div className="rounded-[20px] border border-black/10 bg-[#F7F7F5] p-3.5 sm:p-5 space-y-5">
                                {/* 3-Option Condition Selector */}
                                <div className="space-y-2.5">
                                  <span className="block text-[14px] font-semibold text-black">
                                    Inspection Verdict
                                  </span>

                                  <div
                                    role="radiogroup"
                                    aria-label={`Inspection verdict for ${it.item.name}`}
                                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                                  >
                                    {CONDITION_OPTIONS.map((opt) => {
                                      const selected =
                                        f.condition === opt.value;
                                      const Icon = opt.icon;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          onClick={() =>
                                            setConditionPreset(it, opt.value)
                                          }
                                          className={cn(
                                            "flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[16px] sm:rounded-full px-4 py-2.5 text-[14px] transition-all",
                                            selected
                                              ? opt.activeClass
                                              : "border border-black/14 bg-white font-medium text-black/80 hover:border-black/45"
                                          )}
                                        >
                                          <Icon className="h-4.5 w-4.5 shrink-0" />
                                          <span>{opt.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <p className="text-[13px] text-[#5E5E5A]">
                                    {conditionMeta.helper}
                                  </p>
                                </div>

                                {/* Quantity Steppers */}
                                <div className="space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[14px] font-semibold text-black">
                                      Validated Quantities
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[13px] font-semibold tabular-nums",
                                        totalAccounted > maxQty
                                          ? "text-[#B33C17]"
                                          : totalAccounted === maxQty
                                            ? "text-[#3E6B48]"
                                            : "text-[#8C5811]"
                                      )}
                                    >
                                      Accounted: {totalAccounted} / {maxQty}{" "}
                                      {it.item.unit}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <QuantityStepper
                                      id={`good-qty-${it.id}`}
                                      label="Good Returned Qty"
                                      value={f.returnedQuantity}
                                      max={maxQty}
                                      accent="good"
                                      onChange={(next) =>
                                        updateItemForm(it.id, {
                                          returnedQuantity: next,
                                        })
                                      }
                                    />
                                    <QuantityStepper
                                      id={`damaged-qty-${it.id}`}
                                      label="Damaged Qty"
                                      value={f.damagedQuantity}
                                      max={maxQty}
                                      accent="damaged"
                                      onChange={(next) =>
                                        updateItemForm(it.id, {
                                          damagedQuantity: next,
                                        })
                                      }
                                    />
                                    <QuantityStepper
                                      id={`missing-qty-${it.id}`}
                                      label="Missing Qty"
                                      value={f.missingQuantity}
                                      max={maxQty}
                                      accent="missing"
                                      onChange={(next) =>
                                        updateItemForm(it.id, {
                                          missingQuantity: next,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                {/* Instructor Verification Remarks */}
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <label
                                      htmlFor={`remarks-${it.id}`}
                                      className="text-[14px] font-semibold text-black"
                                    >
                                      Instructor Verification Remarks
                                    </label>
                                    {requiresRemarks ? (
                                      <span className="text-[13px] font-semibold text-[#B33C17]">
                                        Required for damage or missing reports
                                      </span>
                                    ) : (
                                      <span className="text-[13px] text-[#5E5E5A]">
                                        Optional
                                      </span>
                                    )}
                                  </div>

                                  <textarea
                                    id={`remarks-${it.id}`}
                                    rows={3}
                                    value={f.instructorRemarks}
                                    onChange={(e) =>
                                      updateItemForm(it.id, {
                                        instructorRemarks: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      requiresRemarks
                                        ? "Describe the observed damage, fault, or missing accessory (min. 3 characters)..."
                                        : "Document physical inspection findings, accessories checked, or calibration status..."
                                    }
                                    className={cn(
                                      "min-h-[96px] w-full rounded-[16px] border bg-white px-3.5 py-3 text-[15px] leading-relaxed text-black placeholder:text-black/40 focus:border-black focus:outline-none focus:ring-2 focus:ring-[#C4F041]",
                                      requiresRemarks &&
                                        f.instructorRemarks.trim().length < 3
                                        ? "border-[#B33C17]/45"
                                        : "border-black/16"
                                    )}
                                  />
                                </div>

                                {/* Multi-Item Quick Navigation */}
                                {req.items.length > 1 && (
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-black/12 bg-white px-3.5 py-2.5">
                                    <span className="text-[14px] font-medium text-[#5E5E5A] tabular-nums">
                                      Item {itemIdx + 1} of {req.items.length}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openNextItem(req, it.id)}
                                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-black px-4 text-[14px] font-semibold text-white transition-colors hover:bg-black/85"
                                    >
                                      <span>Next item →</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Full-Width Mobile / Crisp Desktop Submit Bar */}
                  <div className="border-t border-black/10 bg-[#F7F7F5] p-4 sm:px-6 sm:py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                            flaggedCount > 0
                              ? "border-black bg-[#F3BD77] text-black"
                              : "border-black bg-[#C4F041] text-black"
                          )}
                        >
                          {flaggedCount > 0 ? (
                            <AlertTriangle className="h-4.5 w-4.5" />
                          ) : (
                            <Check className="h-4.5 w-4.5 stroke-[2.5]" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-black">
                            {flaggedCount > 0
                              ? `${flaggedCount} item${flaggedCount === 1 ? "" : "s"} flagged for damage or missing dispute`
                              : `All ${req.items.length} item${req.items.length === 1 ? "" : "s"} verified in good condition`}
                          </p>
                          <p
                            className={cn(
                              "text-[13px]",
                              missingRemarksCount > 0
                                ? "font-medium text-[#B33C17]"
                                : "text-[#5E5E5A]"
                            )}
                          >
                            {missingRemarksCount > 0
                              ? `Add verification remarks for ${missingRemarksCount} flagged item${missingRemarksCount === 1 ? "" : "s"} before submitting.`
                              : flaggedCount > 0
                                ? "Submitting records the dispute and updates student & lab history."
                                : "Submitting closes the borrowing and restores equipment to available stock."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleVerifyRequest(req)}
                        className={cn(
                          "inline-flex min-h-[48px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black px-6 text-[15px] font-semibold transition-all",
                          isSubmitting
                            ? "cursor-wait border-black/20 bg-[#E6E6E2] text-black/55"
                            : "cursor-pointer bg-[#C4F041] text-black shadow-[3px_3px_0px_#000000] hover:bg-black hover:text-[#C4F041] active:translate-y-[1px]"
                        )}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4.5 w-4.5" />
                        )}
                        <span>
                          {isSubmitting
                            ? "Finalizing..."
                            : "Submit Return Verification"}
                        </span>
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </DottedGridCanvas>
    </div>
  );
}
