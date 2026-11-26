"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck2,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  X,
  XCircle,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { LoopsiiButton } from "@/components/landing/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoComparisonGrid } from "@/components/shared/photo-comparison-grid";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import { readLocalStudentRequests } from "@/lib/student-requests-store";
import { formatDateTime } from "@/lib/utils";
import type {
  ItemPhotoDTO,
  LabRequestDTO,
  LabRequestItemDTO,
  LabRequestStatus,
} from "@/types/contracts";

type HistoryFilter = "ALL" | "ACTIVE" | "PENDING" | "CLOSED" | "REJECTED";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

const PENDING_STATUSES: LabRequestStatus[] = [
  "PENDING_INSTRUCTOR",
  "PENDING_LAB_MANAGER",
];

const ACTIVE_STATUSES: LabRequestStatus[] = [
  "APPROVED",
  "PARTIALLY_ISSUED",
  "ISSUED",
  "RETURN_PENDING",
  "RETURN_SUBMITTED",
  "RETURN_VERIFICATION_PENDING",
  "RETURN_DISPUTED",
  "PARTIALLY_RETURNED",
];

const CLOSED_STATUSES: LabRequestStatus[] = ["CLOSED"];

const REJECTED_STATUSES: LabRequestStatus[] = [
  "REJECTED_BY_INSTRUCTOR",
  "REJECTED_BY_LAB_MANAGER",
  "CANCELLED",
];

interface StatusVisual {
  label: string;
  tone: "closed" | "active" | "pending" | "warning" | "rejected";
  dotClass: string;
  chipClass: string;
}

function getStatusVisual(status: LabRequestStatus): StatusVisual {
  switch (status) {
    case "CLOSED":
      return {
        label: "Closed & Verified",
        tone: "closed",
        dotClass: "bg-[#C4F041] text-black border-black",
        chipClass: "bg-[#F3FBD4] border-black/15 text-black",
      };
    case "APPROVED":
      return {
        label: "Ready for Pickup",
        tone: "active",
        dotClass: "bg-[#C4F041] text-black border-black",
        chipClass: "bg-[#F3FBD4] border-black/15 text-black",
      };
    case "PARTIALLY_ISSUED":
      return {
        label: "Partially Issued",
        tone: "active",
        dotClass: "bg-[#BCE6FA] text-black border-black",
        chipClass: "bg-[#E2F3FC] border-black/15 text-black",
      };
    case "ISSUED":
      return {
        label: "Issued / Borrowed",
        tone: "active",
        dotClass: "bg-[#BCE6FA] text-black border-black",
        chipClass: "bg-[#E2F3FC] border-black/15 text-black",
      };
    case "RETURN_PENDING":
      return {
        label: "Return Pending",
        tone: "warning",
        dotClass: "bg-[#F3BD77] text-black border-black",
        chipClass: "bg-[#FBF0DC] border-black/15 text-black",
      };
    case "RETURN_SUBMITTED":
      return {
        label: "Return Submitted",
        tone: "active",
        dotClass: "bg-[#BCE6FA] text-black border-black",
        chipClass: "bg-[#E2F3FC] border-black/15 text-black",
      };
    case "RETURN_VERIFICATION_PENDING":
      return {
        label: "Awaiting Inspection",
        tone: "warning",
        dotClass: "bg-[#F3BD77] text-black border-black",
        chipClass: "bg-[#FBF0DC] border-black/15 text-black",
      };
    case "PARTIALLY_RETURNED":
      return {
        label: "Partially Returned",
        tone: "warning",
        dotClass: "bg-[#F3BD77] text-black border-black",
        chipClass: "bg-[#FBF0DC] border-black/15 text-black",
      };
    case "RETURN_DISPUTED":
      return {
        label: "Return Disputed",
        tone: "rejected",
        dotClass: "bg-[#FA8E66] text-black border-black",
        chipClass: "bg-[#FDE5DC] border-black/15 text-[#8A290B]",
      };
    case "PENDING_INSTRUCTOR":
      return {
        label: "Instructor Review",
        tone: "pending",
        dotClass: "bg-white text-black border-black",
        chipClass: "bg-[#F5F5F3] border-black/15 text-black",
      };
    case "PENDING_LAB_MANAGER":
      return {
        label: "Lab Manager Review",
        tone: "pending",
        dotClass: "bg-white text-black border-black",
        chipClass: "bg-[#F5F5F3] border-black/15 text-black",
      };
    case "REJECTED_BY_INSTRUCTOR":
      return {
        label: "Rejected by Instructor",
        tone: "rejected",
        dotClass: "bg-[#FA8E66] text-black border-black",
        chipClass: "bg-[#FDE5DC] border-black/15 text-[#8A290B]",
      };
    case "REJECTED_BY_LAB_MANAGER":
      return {
        label: "Rejected by Lab Manager",
        tone: "rejected",
        dotClass: "bg-[#FA8E66] text-black border-black",
        chipClass: "bg-[#FDE5DC] border-black/15 text-[#8A290B]",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        tone: "rejected",
        dotClass: "bg-[#E7E7E4] text-black border-black/40",
        chipClass: "bg-[#F5F5F3] border-black/15 text-[#5E5E5A]",
      };
    default:
      return {
        label: status,
        tone: "pending",
        dotClass: "bg-white text-black border-black",
        chipClass: "bg-[#F5F5F3] border-black/15 text-black",
      };
  }
}

function StatusIcon({
  tone,
  className = "h-4 w-4",
}: {
  tone: StatusVisual["tone"];
  className?: string;
}) {
  switch (tone) {
    case "closed":
      return <Check className={`${className} stroke-[2.5]`} />;
    case "active":
      return <Package className={`${className} stroke-[2]`} />;
    case "warning":
      return <RotateCcw className={`${className} stroke-[2.2]`} />;
    case "rejected":
      return <XCircle className={`${className} stroke-[2.2]`} />;
    default:
      return <Clock className={`${className} stroke-[2.2]`} />;
  }
}

function getItemPhotos(req: LabRequestDTO, it: LabRequestItemDTO): ItemPhotoDTO[] {
  const combined = [
    ...(it.photos ?? []),
    ...(req.photos ?? []).filter((p) => p.requestItemId === it.id),
  ];
  const seen = new Set<string>();
  return combined.filter((p) => {
    const key = p.id || `${p.phase}-${p.angle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRequestPhotoCounts(req: LabRequestDTO): {
  total: number;
  collection: number;
  returned: number;
} {
  let collection = 0;
  let returned = 0;
  for (const it of req.items) {
    const photos = getItemPhotos(req, it);
    for (const p of photos) {
      if (p.phase === "COLLECTION") collection += 1;
      else if (p.phase === "RETURN") returned += 1;
    }
  }
  return { total: collection + returned, collection, returned };
}

function mergeWithLocalRequests(primary: LabRequestDTO[]): LabRequestDTO[] {
  const local = readLocalStudentRequests();
  if (local.length === 0) return primary;
  const localIds = new Set(local.map((r) => r.id));
  return [...local, ...primary.filter((r) => !localIds.has(r.id))];
}

function ExpandedRequestDetails({
  req,
  onOpenPhotos,
}: {
  req: LabRequestDTO;
  onOpenPhotos: (req: LabRequestDTO) => void;
}) {
  const photoCounts = getRequestPhotoCounts(req);
  const verifications = useMemo(() => {
    const list: Array<{
      id: string;
      itemName: string;
      status: string;
      condition: string;
      returnedQuantity: number;
      damagedQuantity: number;
      missingQuantity: number;
      studentComments: string | null;
      instructorRemarks: string | null;
      submittedAt: string;
      verifiedAt: string | null;
      verifiedBy?: string | null;
    }> = [];
    for (const it of req.items) {
      for (const br of it.borrowingRecords ?? []) {
        for (const rv of br.returnVerifications ?? []) {
          list.push({
            id: rv.id,
            itemName: it.item.name,
            status: rv.status,
            condition: rv.condition,
            returnedQuantity: rv.returnedQuantity,
            damagedQuantity: rv.damagedQuantity,
            missingQuantity: rv.missingQuantity,
            studentComments: rv.studentComments,
            instructorRemarks: rv.instructorRemarks,
            submittedAt: rv.submittedAt,
            verifiedAt: rv.verifiedAt,
            verifiedBy: rv.verifiedBy?.fullName ?? null,
          });
        }
      }
    }
    return list;
  }, [req]);

  return (
    <div className="space-y-4 border-t border-black/10 bg-[#F7F7F5]/80 p-4 sm:p-5">
      {/* Purpose & Request Metadata */}
      {req.purpose.trim() && (
        <div className="rounded-[16px] border border-black/10 bg-white p-3.5">
          <p className="text-[13px] font-medium text-[#5E5E5A]">Lab Purpose</p>
          <p className="mt-1 text-[14px] leading-relaxed text-black">
            {req.purpose}
          </p>
        </div>
      )}

      {/* Rejection Notice */}
      {req.rejectionReason && (
        <div className="flex items-start gap-2.5 rounded-[16px] border border-[#FA8E66] bg-[#FFF5F3] p-3.5 text-[14px] text-black">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B33C17]" />
          <div className="min-w-0">
            <p className="font-semibold text-[#8A290B]">Rejection Reason</p>
            <p className="mt-0.5 text-[14px] text-black/80">
              {req.rejectionReason}
            </p>
          </div>
        </div>
      )}

      {/* Itemized Equipment Breakdown */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[14px] font-semibold text-black">
            Equipment Items ({req.items.length})
          </h4>
          <span className="text-[13px] text-[#5E5E5A] tabular-nums">
            {photoCounts.collection} collection · {photoCounts.returned} return photos
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {req.items.map((it) => {
            const itemPhotos = getItemPhotos(req, it);
            const colCount = itemPhotos.filter((p) => p.phase === "COLLECTION").length;
            const retCount = itemPhotos.filter((p) => p.phase === "RETURN").length;
            const latestBorrow = it.borrowingRecords?.[0];

            return (
              <div
                key={it.id}
                className="flex items-start gap-3 rounded-[16px] border border-black/12 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.item.imageUrl || getPartImageUrl(it.item.code)}
                  alt={it.item.name}
                  className="h-14 w-16 shrink-0 rounded-[12px] border border-black/10 bg-[#F5F5F3] object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[14px] font-semibold text-black">
                    {it.item.name}
                  </p>
                  <p className="font-mono text-[13px] text-[#5E5E5A] tabular-nums">
                    {it.item.code}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[13px] text-black/80 tabular-nums">
                    <span>
                      Req: <strong>{it.requestedQuantity}</strong> {it.item.unit}
                    </span>
                    {it.approvedQuantity > 0 && (
                      <span>
                        Appr: <strong>{it.approvedQuantity}</strong>
                      </span>
                    )}
                    {it.issuedQuantity > 0 && (
                      <span>
                        Issued: <strong>{it.issuedQuantity}</strong>
                      </span>
                    )}
                    {it.returnedQuantity > 0 && (
                      <span>
                        Ret: <strong>{it.returnedQuantity}</strong>
                      </span>
                    )}
                    {it.damagedQuantity > 0 && (
                      <span className="font-medium text-[#B33C17]">
                        Damaged: {it.damagedQuantity}
                      </span>
                    )}
                    {it.missingQuantity > 0 && (
                      <span className="font-medium text-[#B33C17]">
                        Missing: {it.missingQuantity}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-[#5E5E5A] tabular-nums">
                    <span>
                      Photos: {colCount}/4 pickup · {retCount}/4 return
                    </span>
                    {latestBorrow?.dueAt && (
                      <span>Due {formatDateTime(latestBorrow.dueAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval & Verification Audit Log */}
      {(req.approvals.length > 0 || verifications.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {req.approvals.length > 0 && (
            <div className="rounded-[16px] border border-black/12 bg-white p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
                <ShieldCheck className="h-4 w-4 text-black/70" />
                <span>Approval Trail</span>
              </div>
              <div className="space-y-2.5">
                {req.approvals.map((appr) => (
                  <div
                    key={appr.id}
                    className="border-l-2 border-black/15 pl-3 text-[13px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-black">
                        {appr.approver.fullName}
                      </span>
                      <span className="text-[#5E5E5A] tabular-nums">
                        {formatDateTime(appr.createdAt)}
                      </span>
                    </div>
                    <p className="text-[#5E5E5A]">
                      {appr.stage === "INSTRUCTOR_REVIEW"
                        ? "Instructor Review"
                        : "Lab Manager Final"}{" "}
                      ·{" "}
                      <span
                        className={
                          appr.decision === "APPROVED"
                            ? "font-medium text-[#3E6B48]"
                            : "font-medium text-[#B33C17]"
                        }
                      >
                        {appr.decision === "APPROVED" ? "Approved" : "Rejected"}
                      </span>
                    </p>
                    {appr.comments && (
                      <p className="mt-0.5 text-black/75">{appr.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {verifications.length > 0 && (
            <div className="rounded-[16px] border border-black/12 bg-white p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
                <FileCheck2 className="h-4 w-4 text-black/70" />
                <span>Return Verification</span>
              </div>
              <div className="space-y-2.5">
                {verifications.map((rv) => (
                  <div
                    key={rv.id}
                    className="border-l-2 border-black/15 pl-3 text-[13px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-black">
                        {rv.itemName}
                      </span>
                      <span className="text-[#5E5E5A] tabular-nums">
                        {formatDateTime(rv.verifiedAt ?? rv.submittedAt)}
                      </span>
                    </div>
                    <p className="text-[#5E5E5A]">
                      Condition: <strong className="text-black">{rv.condition}</strong> ·
                      Returned: <strong className="text-black">{rv.returnedQuantity}</strong>
                      {rv.verifiedBy ? ` · Verified by ${rv.verifiedBy}` : " · Pending check"}
                    </p>
                    {rv.studentComments && (
                      <p className="mt-0.5 text-black/75">
                        Student note: {rv.studentComments}
                      </p>
                    )}
                    {rv.instructorRemarks && (
                      <p className="mt-0.5 text-black/75">
                        Instructor note: {rv.instructorRemarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Bar inside Expanded Details */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[13px] text-[#5E5E5A] tabular-nums">
          Updated {formatDateTime(req.updatedAt)} · {req.campus.name}
        </span>
        <button
          type="button"
          onClick={() => onOpenPhotos(req)}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-black bg-black px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#C4F041] hover:text-black"
        >
          <Camera className="h-4 w-4" />
          <span>
            Open Photo Archive ({photoCounts.total})
          </span>
        </button>
      </div>
    </div>
  );
}

export default function StudentHistoryPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [photoModalReq, setPhotoModalReq] = useState<LabRequestDTO | null>(null);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setRequests(mergeWithLocalRequests(DEMO_REQUESTS));
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.requests.list({ pageSize: 80 });
      setRequests(mergeWithLocalRequests(res.data));
    } catch {
      setRequests(mergeWithLocalRequests(DEMO_REQUESTS));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: ["request.status_changed", "borrowing.issued", "return.verified"],
    onEvent: () => load(),
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const stats = useMemo(() => {
    let active = 0;
    let pending = 0;
    let closed = 0;
    let rejected = 0;
    let totalPhotos = 0;

    for (const req of requests) {
      if (ACTIVE_STATUSES.includes(req.status)) active += 1;
      else if (PENDING_STATUSES.includes(req.status)) pending += 1;
      else if (CLOSED_STATUSES.includes(req.status)) closed += 1;
      else if (REJECTED_STATUSES.includes(req.status)) rejected += 1;

      totalPhotos += getRequestPhotoCounts(req).total;
    }

    return {
      total: requests.length,
      active,
      pending,
      closed,
      rejected,
      totalPhotos,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (filter === "ACTIVE" && !ACTIVE_STATUSES.includes(req.status)) {
        return false;
      }
      if (filter === "PENDING" && !PENDING_STATUSES.includes(req.status)) {
        return false;
      }
      if (filter === "CLOSED" && !CLOSED_STATUSES.includes(req.status)) {
        return false;
      }
      if (filter === "REJECTED" && !REJECTED_STATUSES.includes(req.status)) {
        return false;
      }

      if (!q) return true;
      const statusLabel = getStatusVisual(req.status).label.toLowerCase();
      return (
        req.requestCode.toLowerCase().includes(q) ||
        req.instructor.fullName.toLowerCase().includes(q) ||
        req.purpose.toLowerCase().includes(q) ||
        statusLabel.includes(q) ||
        req.items.some(
          (it) =>
            it.item.name.toLowerCase().includes(q) ||
            it.item.code.toLowerCase().includes(q)
        )
      );
    });
  }, [requests, filter, search]);

  const filterTabs: Array<{ key: HistoryFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: stats.total },
    { key: "ACTIVE", label: "Active", count: stats.active },
    { key: "PENDING", label: "Pending", count: stats.pending },
    { key: "CLOSED", label: "Closed", count: stats.closed },
    { key: "REJECTED", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div
      className="space-y-4 overflow-x-clip"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Editorial Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Borrowing History & Photo Archive
          </h1>
          <p className="mt-1 text-[14px] leading-snug text-[#5E5E5A]">
            Complete log of your equipment requests, return verifications, and preserved 4-angle photo evidence.
          </p>
        </div>

        <div className="shrink-0">
          <LoopsiiButton
            label="Browse Inventory"
            href="/student/inventory"
            size="md"
            hideArrow
          />
        </div>
      </div>

      {/* Dotted-Grid Spatial Canvas (non-pannable for crisp mobile scrolling) */}
      <DottedGridCanvas
        pannable={false}
        className="flex flex-col rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-6 lg:p-7"
      >
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-8 text-center shadow-card">
            <p className="text-[15px] text-[#5E5E5A]">
              Loading borrowing history...
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="m-auto w-full max-w-[460px] rounded-[24px] border border-black/14 bg-white p-7 sm:p-10 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-black/14 bg-[#F3FBD4] text-black">
              <Package className="h-5 w-5" />
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-medium tracking-[-0.03em] text-black">
              No borrowing history yet
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#5E5E5A]">
              Request hardware from your campus lab catalog and every approval, handover, return check, and 4-angle photo proof will be archived here.
            </p>
            <div className="mt-6 flex justify-center">
              <LoopsiiButton
                label="Browse Inventory"
                href="/student/inventory"
                size="md"
                hideArrow
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 sm:gap-5">
            {/* Summary Stats Strip: 2x2 on Mobile, 4-col on Desktop */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              <div className="rounded-[20px] border border-black/14 bg-white p-4 shadow-card">
                <p className="text-[13px] font-medium text-[#5E5E5A]">
                  Total Requests
                </p>
                <p className="mt-1.5 text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                  {stats.total}
                </p>
              </div>

              <div className="rounded-[20px] border border-black/14 bg-white p-4 shadow-card">
                <p className="text-[13px] font-medium text-[#5E5E5A]">
                  Active & Issued
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                    {stats.active}
                  </p>
                  {stats.pending > 0 && (
                    <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                      +{stats.pending} pending
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/14 bg-white p-4 shadow-card">
                <p className="text-[13px] font-medium text-[#5E5E5A]">
                  Closed & Verified
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                    {stats.closed}
                  </p>
                  {stats.closed > 0 && (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black bg-[#C4F041] text-black">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/14 bg-white p-4 shadow-card">
                <p className="text-[13px] font-medium text-[#5E5E5A]">
                  Evidence Photos
                </p>
                <p className="mt-1.5 text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                  {stats.totalPhotos}
                </p>
              </div>
            </div>

            {/* Filter Pill Strip (single-row horizontal scroll on phones) + Full-Width Search Bar */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div
                role="tablist"
                aria-label="Filter borrowing history by status"
                className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {filterTabs.map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.key)}
                      className={`inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors ${
                        active
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.18)]"
                          : "border-black/14 bg-white text-black hover:border-black/35"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`tabular-nums ${
                          active ? "text-[#C4F041]" : "text-[#5E5E5A]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-[310px] md:shrink-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, part, or instructor..."
                  aria-label="Search borrowing history"
                  className="min-h-[44px] w-full rounded-full border border-black/14 bg-white pl-10 pr-10 text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-black/50 hover:bg-[#F5F5F3] hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Empty Search/Filter Result */}
            {filteredRequests.length === 0 ? (
              <div className="mx-auto my-6 w-full max-w-[420px] rounded-[24px] border border-black/14 bg-white p-7 text-center shadow-card">
                <p className="text-[16px] font-semibold text-black">
                  No matching history records
                </p>
                <p className="mt-1.5 text-[14px] text-[#5E5E5A]">
                  Try selecting another status filter or clearing your search query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("ALL");
                    setSearch("");
                  }}
                  className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-black/15 bg-[#F5F5F3] px-5 py-2 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041]"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW (< md): Tactile Vertical Timeline Activity Cards (Zero Horizontal Overflow) */}
                <div className="relative space-y-3.5 pl-5 md:hidden">
                  {/* Continuous Vertical Timeline Rail */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-5 left-[7px] top-5 w-[2px] rounded-full bg-black/14"
                  />

                  {filteredRequests.map((req) => {
                    const visual = getStatusVisual(req.status);
                    const isExpanded = Boolean(expandedIds[req.id]);
                    const photoCounts = getRequestPhotoCounts(req);
                    const totalUnits = req.items.reduce(
                      (sum, it) => sum + it.requestedQuantity,
                      0
                    );
                    const hasIssueFlags = req.items.some(
                      (it) => it.damagedQuantity > 0 || it.missingQuantity > 0
                    );

                    return (
                      <div key={req.id} className="relative">
                        {/* Timeline Node Dot */}
                        <span
                          aria-hidden="true"
                          className={`absolute -left-5 top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${visual.dotClass}`}
                        />

                        <article className="overflow-hidden rounded-[24px] border border-black/14 bg-white shadow-card">
                          <div className="space-y-3.5 p-4">
                            {/* Top Row: Request Code + Date */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[14px] font-semibold text-black tabular-nums">
                                {req.requestCode}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[13px] text-[#5E5E5A] tabular-nums">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                {formatDateTime(req.createdAt)}
                              </span>
                            </div>

                            {/* Status Indicator Icon + Readable 14px Label */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[14px] font-medium ${visual.chipClass}`}
                              >
                                <StatusIcon
                                  tone={visual.tone}
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span>{visual.label}</span>
                              </span>
                              {hasIssueFlags && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#FA8E66] bg-[#FFF5F3] px-2.5 py-1 text-[13px] font-medium text-[#8A290B]">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Flagged
                                </span>
                              )}
                            </div>

                            {/* Part Thumbnails + Item Summary */}
                            <div className="flex items-start gap-3">
                              <div className="flex shrink-0 items-center -space-x-2.5 pt-0.5">
                                {req.items.slice(0, 3).map((it) => (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    key={it.id}
                                    src={
                                      it.item.imageUrl ||
                                      getPartImageUrl(it.item.code)
                                    }
                                    alt={it.item.name}
                                    className="h-11 w-11 rounded-[12px] border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                                  />
                                ))}
                                {req.items.length > 3 && (
                                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border-2 border-white bg-black text-[13px] font-semibold text-white">
                                    +{req.items.length - 3}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-black">
                                  {req.items
                                    .map(
                                      (it) =>
                                        `${it.item.name} (×${it.requestedQuantity})`
                                    )
                                    .join(", ")}
                                </p>
                                <p className="mt-1 text-[13px] text-[#5E5E5A] tabular-nums">
                                  {req.items.length} part
                                  {req.items.length === 1 ? "" : "s"} ·{" "}
                                  {totalUnits} unit
                                  {totalUnits === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>

                            {/* Instructor Row */}
                            <div className="flex items-center gap-2 rounded-[14px] bg-[#F7F7F5] px-3 py-2 text-[14px] text-[#5E5E5A]">
                              <User className="h-4 w-4 shrink-0 text-black/55" />
                              <span className="truncate font-medium text-black">
                                {req.instructor.fullName}
                              </span>
                            </div>

                            {/* Action Buttons (Touch-Friendly 44px Targets) */}
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => toggleExpand(req.id)}
                                aria-expanded={isExpanded}
                                className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[14px] font-medium transition-colors ${
                                  isExpanded
                                    ? "border-black bg-[#F3FBD4] text-black"
                                    : "border-black/14 bg-white text-black hover:border-black/35"
                                }`}
                              >
                                <span>{isExpanded ? "Hide Info" : "Details"}</span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setPhotoModalReq(req)}
                                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-black bg-black px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#C4F041] hover:text-black"
                              >
                                <Camera className="h-4 w-4 shrink-0" />
                                <span className="tabular-nums">
                                  Photos ({photoCounts.total})
                                </span>
                              </button>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.24, ease: LP_EASE }}
                                className="overflow-hidden"
                              >
                                <ExpandedRequestDetails
                                  req={req}
                                  onOpenPhotos={setPhotoModalReq}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </article>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW (>= md): Rich Scannable Architectural History List with Expandable Audit Rows */}
                <div className="hidden overflow-hidden rounded-[24px] border border-black/14 bg-white shadow-card md:block">
                  {/* Column Header Band */}
                  <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_auto] items-center gap-4 border-b border-black/10 bg-[#F7F7F5] px-5 py-3.5 text-[13px] font-semibold text-[#5E5E5A]">
                    <div>Request & Equipment</div>
                    <div>Instructor</div>
                    <div>Status</div>
                    <div>Date</div>
                    <div className="text-right">Evidence & Audit</div>
                  </div>

                  <div className="divide-y divide-black/10">
                    {filteredRequests.map((req) => {
                      const visual = getStatusVisual(req.status);
                      const isExpanded = Boolean(expandedIds[req.id]);
                      const photoCounts = getRequestPhotoCounts(req);
                      const totalUnits = req.items.reduce(
                        (sum, it) => sum + it.requestedQuantity,
                        0
                      );

                      return (
                        <div key={req.id} className="transition-colors">
                          <div
                            className={`grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_auto] items-center gap-4 px-5 py-4 transition-colors ${
                              isExpanded ? "bg-[#FAFBF6]" : "hover:bg-[#F7F7F5]/70"
                            }`}
                          >
                            {/* Request & Equipment */}
                            <div className="flex min-w-0 items-center gap-3.5">
                              <div className="flex shrink-0 items-center -space-x-2.5">
                                {req.items.slice(0, 3).map((it) => (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    key={it.id}
                                    src={
                                      it.item.imageUrl ||
                                      getPartImageUrl(it.item.code)
                                    }
                                    alt={it.item.name}
                                    className="h-11 w-11 rounded-[12px] border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                                  />
                                ))}
                                {req.items.length > 3 && (
                                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border-2 border-white bg-black text-[13px] font-semibold text-white">
                                    +{req.items.length - 3}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[13px] font-semibold text-black tabular-nums">
                                    {req.requestCode}
                                  </span>
                                  <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                                    · {totalUnits} qty
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-[14px] font-medium text-black">
                                  {req.items
                                    .map(
                                      (it) =>
                                        `${it.item.name} (×${it.requestedQuantity})`
                                    )
                                    .join(", ")}
                                </p>
                              </div>
                            </div>

                            {/* Instructor */}
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-black">
                                {req.instructor.fullName}
                              </p>
                              <p className="truncate text-[13px] text-[#5E5E5A]">
                                {req.campus.code}
                              </p>
                            </div>

                            {/* Status Indicator Icon + Readable 14px Label */}
                            <div className="min-w-0">
                              <span
                                className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-medium ${visual.chipClass}`}
                              >
                                <StatusIcon
                                  tone={visual.tone}
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span className="truncate">{visual.label}</span>
                              </span>
                            </div>

                            {/* Date */}
                            <div className="text-[13px] text-[#5E5E5A] tabular-nums">
                              {formatDateTime(req.createdAt)}
                            </div>

                            {/* Evidence & Expand Actions */}
                            <div className="flex shrink-0 items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setPhotoModalReq(req)}
                                className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-black/14 bg-white px-3.5 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                              >
                                <Camera className="h-3.5 w-3.5 shrink-0" />
                                <span className="tabular-nums">
                                  Photos ({photoCounts.total})
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleExpand(req.id)}
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? `Collapse details for ${req.requestCode}`
                                    : `Expand details for ${req.requestCode}`
                                }
                                className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                                  isExpanded
                                    ? "border-black bg-black text-[#C4F041]"
                                    : "border-black/14 bg-white text-black hover:border-black/40 hover:bg-[#F5F5F3]"
                                }`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.24, ease: LP_EASE }}
                                className="overflow-hidden"
                              >
                                <ExpandedRequestDetails
                                  req={req}
                                  onOpenPhotos={setPhotoModalReq}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DottedGridCanvas>

      {/* Preserved 4-Angle Photo Evidence Archive Dialog */}
      <Dialog
        open={Boolean(photoModalReq)}
        onOpenChange={(open) => !open && setPhotoModalReq(null)}
      >
        <DialogContent className="max-w-3xl rounded-[24px] border border-black/14 bg-white p-4 sm:p-6 text-black">
          {photoModalReq && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-[17px] sm:text-[19px] font-semibold text-black">
                  {photoModalReq.requestCode} · Photo Evidence Archive
                </DialogTitle>
                <DialogDescription className="text-[14px] text-[#5E5E5A]">
                  Preserved 4-angle collection and return photos · Instructor:{" "}
                  {photoModalReq.instructor.fullName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-1">
                {photoModalReq.items.map((it) => {
                  const itemPhotos = getItemPhotos(photoModalReq, it);
                  return (
                    <div
                      key={it.id}
                      className="space-y-3 border-t border-black/10 pt-5 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            it.item.imageUrl || getPartImageUrl(it.item.code)
                          }
                          alt={it.item.name}
                          className="h-11 w-12 shrink-0 rounded-[10px] border border-black/10 bg-[#F5F5F3] object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-black">
                            {it.item.name}
                          </p>
                          <p className="font-mono text-[13px] text-[#5E5E5A] tabular-nums">
                            {it.item.code} · Qty {it.requestedQuantity}{" "}
                            {it.item.unit}
                          </p>
                        </div>
                      </div>
                      <PhotoComparisonGrid
                        photos={itemPhotos}
                        itemName={it.item.name}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
