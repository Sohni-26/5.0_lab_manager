"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  PackageCheck,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import {
  DottedGridCanvas,
  useDottedCanvas,
} from "@/components/dashboard/spatial-canvas";
import {
  FLOW_PALETTES,
  RequestFlowchartCard,
} from "@/components/dashboard/request-flowchart";
import { LoopsiiButton } from "@/components/landing/primitives";
import { useLenis } from "@/components/landing/smooth-scroll";
import { useAuth } from "@/hooks/use-auth";
import { useMultiPinSelection } from "@/hooks/use-multi-pin";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  readMergedDemoRequests,
  upsertLocalStudentRequest,
} from "@/lib/student-requests-store";
import {
  REQUIRED_PHOTO_ANGLES,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type LabRequestStatus,
  type PhotoAngle,
  type RequestApprovalDTO,
} from "@/types/contracts";

type QueueFilter = "PENDING" | "HANDOVER" | "ALL";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const PAGE_SIZE = 3;

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  FRONT_TOP: "Front / Top",
  BACK_BOTTOM: "Back / Bottom",
  LEFT_SIDE: "Left Side",
  RIGHT_SIDE: "Right Side",
};

function getMissingCollectionAngles(item: LabRequestItemDTO): PhotoAngle[] {
  const uploaded = new Set(
    (item.photos ?? [])
      .filter((p) => p.phase === "COLLECTION")
      .map((p) => p.angle)
  );
  return REQUIRED_PHOTO_ANGLES.filter((angle) => !uploaded.has(angle));
}

function countCollectionPhotos(item: LabRequestItemDTO): number {
  return REQUIRED_PHOTO_ANGLES.length - getMissingCollectionAngles(item).length;
}

function countReturnPhotos(req: LabRequestDTO): number {
  return req.items.reduce(
    (sum, it) =>
      sum + (it.photos ?? []).filter((p) => p.phase === "RETURN").length,
    0
  );
}

function getRequestPriority(status: LabRequestStatus): number {
  if (status === "PENDING_INSTRUCTOR") return 0;
  if (status === "APPROVED" || status === "PARTIALLY_ISSUED") return 1;
  if (
    status === "RETURN_VERIFICATION_PENDING" ||
    status === "RETURN_SUBMITTED"
  ) {
    return 2;
  }
  if (status === "PENDING_LAB_MANAGER") return 3;
  if (status === "ISSUED" || status === "RETURN_PENDING") return 4;
  return 5;
}

function getShortStatusLabel(status: LabRequestStatus): string {
  switch (status) {
    case "PENDING_INSTRUCTOR":
      return "Needs approval";
    case "PENDING_LAB_MANAGER":
      return "With lab manager";
    case "APPROVED":
    case "PARTIALLY_ISSUED":
      return "Ready for handover";
    case "ISSUED":
    case "RETURN_PENDING":
      return "Issued";
    case "RETURN_SUBMITTED":
    case "RETURN_VERIFICATION_PENDING":
      return "Return to validate";
    case "RETURN_DISPUTED":
      return "Return disputed";
    case "PARTIALLY_RETURNED":
      return "Partially returned";
    case "CLOSED":
      return "Completed";
    case "REJECTED_BY_INSTRUCTOR":
    case "REJECTED_BY_LAB_MANAGER":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "Just now";
  }
}

/** Freehand draggable canvas item bounded inside the finite DottedGridCanvas */
function CanvasDraggableItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { canvasRef, resetSignal, markMoved, isMobileViewport } =
    useDottedCanvas();

  if (isMobileViewport) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={`instructor-drag-${resetSignal}`}
      data-canvas-draggable="true"
      drag
      dragConstraints={canvasRef}
      dragElastic={0.08}
      dragMomentum={false}
      onDragStart={markMoved}
      whileDrag={{ scale: 1.008, zIndex: 25 }}
      className={`cursor-grab active:cursor-grabbing ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

export function InstructorRequestFlow() {
  const { user, isDemoMode } = useAuth();
  const { lenis } = useLenis();
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [page, setPage] = useState(1);

  // Per-request inline decision controls state (supports multiple pinned requests simultaneously!)
  const [notesByReq, setNotesByReq] = useState<Record<string, string>>({});
  const [rejectOpenByReq, setRejectOpenByReq] = useState<Record<string, boolean>>({});
  const [rejectReasonByReq, setRejectReasonByReq] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (isDemoMode) {
      setRequests(readMergedDemoRequests(DEMO_REQUESTS));
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      setRequests(res.data);
    } catch {
      setRequests(readMergedDemoRequests(DEMO_REQUESTS));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: [
      "request.created",
      "request.status_changed",
      "borrowing.issued",
      "return.submitted",
      "return.verified",
    ],
    onEvent: () => {
      loadRequests();
    },
  });

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const prioDiff =
        getRequestPriority(a.status) - getRequestPriority(b.status);
      if (prioDiff !== 0) return prioDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests]);

  const requestIndexMap = useMemo(() => {
    const chronological = [...requests].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return new Map(chronological.map((r, idx) => [r.id, idx]));
  }, [requests]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING_INSTRUCTOR").length,
    [requests]
  );

  const handoverCount = useMemo(
    () =>
      requests.filter(
        (r) => r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED"
      ).length,
    [requests]
  );

  const returnsToValidateCount = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "RETURN_VERIFICATION_PENDING" ||
          r.status === "RETURN_SUBMITTED"
      ).length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (filter === "PENDING") {
      return sortedRequests.filter((r) => r.status === "PENDING_INSTRUCTOR");
    }
    if (filter === "HANDOVER") {
      return sortedRequests.filter(
        (r) => r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED"
      );
    }
    return sortedRequests;
  }, [sortedRequests, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const paginatedRequests = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, safePage]);

  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRequests.length, safePage * PAGE_SIZE);

  const getRequestId = useCallback((r: LabRequestDTO) => r.id, []);
  const {
    selectedItems: activeRequests,
    isMultiMode,
    isSelected: isRequestSelected,
    handleSelect: handleMultiSelect,
    unpin: unpinRequest,
    collapseToPrimary,
  } = useMultiPinSelection(filteredRequests, getRequestId, 6);

  useEffect(() => {
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [requests.length, filter, page, activeRequests.length, lenis]);

  const handleSelectRequest = (
    reqId: string,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    handleMultiSelect(reqId, e);
    if (
      !(e?.ctrlKey || e?.metaKey) &&
      typeof window !== "undefined" &&
      window.innerWidth < 1280
    ) {
      requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const applyLocalRequestUpdate = useCallback(
    (updated: LabRequestDTO, persistToLocalStore: boolean) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      if (persistToLocalStore) {
        upsertLocalStudentRequest(updated);
      }
    },
    []
  );

  const buildUpdatedDecisionDTO = (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED",
    comments?: string
  ): LabRequestDTO => {
    const nowIso = new Date().toISOString();
    const cleanComments = comments?.trim() || null;
    const approverId = user?.id ?? req.instructor.id;
    const approverName = user?.fullName ?? req.instructor.fullName;

    const approvalEntry: RequestApprovalDTO = {
      id: `appr-inst-${Date.now()}`,
      requestId: req.id,
      stage: "INSTRUCTOR_REVIEW",
      decision,
      approverId,
      comments: cleanComments,
      createdAt: nowIso,
      approver: {
        id: approverId,
        fullName: approverName,
        role: "INSTRUCTOR",
      },
    };

    return {
      ...req,
      status:
        decision === "APPROVED" ? "APPROVED" : "REJECTED_BY_INSTRUCTOR",
      rejectionReason: decision === "REJECTED" ? cleanComments : null,
      updatedAt: nowIso,
      items:
        decision === "APPROVED"
          ? req.items.map((it) => ({
              ...it,
              approvedQuantity: it.approvedQuantity || it.requestedQuantity,
            }))
          : req.items,
      approvals: [...(req.approvals ?? []), approvalEntry],
    };
  };

  const handleInstructorDecision = async (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED",
    comments?: string
  ) => {
    const cleanComments = comments?.trim() ?? "";
    if (decision === "REJECTED" && cleanComments.length < 3) {
      toast.error("Please add a brief reason before rejecting this request.");
      return;
    }

    setBusyId(req.id);
    try {
      if (isDemoMode) {
        const updated = buildUpdatedDecisionDTO(req, decision, cleanComments);
        applyLocalRequestUpdate(updated, true);
      } else {
        try {
          const res = await apiClient.requests.instructorApproval(req.id, {
            decision,
            comments: cleanComments || undefined,
          });
          applyLocalRequestUpdate(res.data, false);
        } catch {
          const updated = buildUpdatedDecisionDTO(req, decision, cleanComments);
          applyLocalRequestUpdate(updated, true);
        }
      }

      toast.success(
        decision === "APPROVED"
          ? `${req.requestCode} approved — stock reserved & ready for pickup`
          : `${req.requestCode} rejected and student notified`
      );
      setNotesByReq((prev) => ({ ...prev, [req.id]: "" }));
      setRejectOpenByReq((prev) => ({ ...prev, [req.id]: false }));
      setRejectReasonByReq((prev) => ({ ...prev, [req.id]: "" }));
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmHandover = async (req: LabRequestDTO) => {
    const incompleteItems = req.items
      .map((it) => ({
        name: it.item.name,
        missing: getMissingCollectionAngles(it),
      }))
      .filter((entry) => entry.missing.length > 0);

    if (incompleteItems.length > 0) {
      const first = incompleteItems[0];
      const missingText = first.missing.map((a) => ANGLE_LABELS[a]).join(", ");
      toast.error(
        `Cannot confirm handover yet — ${first.name} is missing ${missingText} collection photo${first.missing.length === 1 ? "" : "s"}.`
      );
      return;
    }

    const buildIssuedDTO = (): LabRequestDTO => {
      const nowIso = new Date().toISOString();
      return {
        ...req,
        status: "ISSUED",
        updatedAt: nowIso,
        items: req.items.map((it) => ({
          ...it,
          issuedQuantity: it.approvedQuantity || it.requestedQuantity,
        })),
      };
    };

    setBusyId(req.id);
    try {
      if (isDemoMode) {
        applyLocalRequestUpdate(buildIssuedDTO(), true);
      } else {
        try {
          const res = await apiClient.requests.confirmCollection(req.id);
          applyLocalRequestUpdate(res.data, false);
        } catch {
          applyLocalRequestUpdate(buildIssuedDTO(), true);
        }
      }

      toast.success(
        `${req.requestCode} physical handover confirmed — items marked Issued`
      );
    } finally {
      setBusyId(null);
    }
  };

  const renderStatusIcon = (status: LabRequestStatus) => {
    if (status === "CLOSED") {
      return <Check className="h-3.5 w-3.5 stroke-[2.5]" />;
    }
    if (
      status === "REJECTED_BY_INSTRUCTOR" ||
      status === "REJECTED_BY_LAB_MANAGER"
    ) {
      return <XCircle className="h-3.5 w-3.5 stroke-[2.2]" />;
    }
    if (status === "APPROVED" || status === "PARTIALLY_ISSUED") {
      return <PackageCheck className="h-3.5 w-3.5 stroke-[2.2]" />;
    }
    if (
      status === "RETURN_VERIFICATION_PENDING" ||
      status === "RETURN_SUBMITTED"
    ) {
      return <RotateCcw className="h-3.5 w-3.5 stroke-[2.2]" />;
    }
    return <Clock className="h-3.5 w-3.5 stroke-[2.2]" />;
  };

  const isBoardEmpty = !loading && requests.length === 0;

  return (
    <div
      className="w-full min-w-0 space-y-4"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Clean Editorial Header (matching Student My Requests) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Review &amp; Validate
          </h1>
          <p className="mt-0.5 text-[13.5px] sm:text-[14px] text-[#5E5E5A]">
            Accept student requests, verify handover photos, and inspect returns live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {returnsToValidateCount > 0 && (
            <Link
              href="/instructor/return-verification"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#C4F041] px-4 text-[13.5px] font-semibold text-black shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-colors hover:bg-black hover:text-[#C4F041]"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">
                Validate Returns ({returnsToValidateCount})
              </span>
            </Link>
          )}
          <LoopsiiButton
            label="Campus Inventory"
            href="/instructor/inventory"
            size="sm"
            hideArrow
          />
        </div>
      </div>

      {/* Dotted-Grid Spatial Board */}
      <DottedGridCanvas pannable className="flex flex-col p-4 pb-20 sm:p-6 sm:pb-20">
        {isBoardEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: LP_EASE }}
            className="m-auto w-full max-w-lg rounded-[28px] bg-white p-8 sm:p-10 text-center ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(0,0,0,0.055)]"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#C4F041] text-black">
              <CheckCircle2 className="h-7 w-7 stroke-[2.2]" />
            </div>
            <h2 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.03em] text-black leading-[1.12]">
              All student requests caught up
            </h2>
            <p className="mt-2.5 text-[14px] sm:text-[15px] text-[#5E5E5A] leading-relaxed">
              New borrowing requests assigned to you will appear right here with their live approval flowchart.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <LoopsiiButton
                label="Browse Campus Inventory"
                href="/instructor/inventory"
                hideArrow
                className="w-full sm:w-auto [&>span]:w-full sm:[&>span]:w-auto [&>span]:justify-center"
              />
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-1 flex-col gap-5">
            {/* Clean Top Filter Bar Directly on the Dotted Grid */}
            <div
              data-canvas-controls="true"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 overflow-x-auto touch-pan-x pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { key: "ALL" as const, label: "All", count: requests.length },
                    { key: "PENDING" as const, label: "Pending", count: pendingCount },
                    { key: "HANDOVER" as const, label: "Handover", count: handoverCount },
                  ] as const
                ).map((pill) => {
                  const active = filter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => {
                        setFilter(pill.key);
                        setPage(1);
                      }}
                      className={`inline-flex h-10 shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-all cursor-pointer ${
                        active
                          ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                          : "bg-white/95 text-black ring-1 ring-black/[0.06] hover:bg-white"
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={`tabular-nums ${
                          active ? "text-[#C4F041]" : "text-black/45"
                        }`}
                      >
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                {isMultiMode ? (
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center rounded-full bg-[#C4F041] px-3 py-1 text-[13px] font-semibold text-black tabular-nums">
                      {activeRequests.length} pinned
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
                    Ctrl+Click cards to compare multiple
                  </span>
                )}
                <Link
                  href="/instructor/requests"
                  className="hidden sm:inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#5E5E5A] hover:text-black transition-colors whitespace-nowrap"
                >
                  Open full queue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Responsive Spatial Split:
                Stacks cleanly below xl (1280px) so split-screen/laptops never crush columns;
                Opens into a spacious 4 + 8 board on wide desktops (xl+) */}
            <div className="grid flex-1 grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* QUEUE DECK (floating directly on dotted grid — zero double-boxed outer card!) */}
              <div
                data-canvas-controls="true"
                className="xl:col-span-4 min-w-0 space-y-3"
              >
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="rounded-[24px] bg-white p-4 ring-1 ring-black/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.04)] space-y-2.5"
                      >
                        <div className="lp-shimmer h-4 w-36 rounded-full" />
                        <div className="lp-shimmer h-3.5 w-24 rounded-full" />
                        <div className="lp-shimmer h-8 w-full rounded-full mt-2" />
                      </div>
                    ))}
                  </div>
                ) : paginatedRequests.length === 0 ? (
                  <div className="rounded-[24px] bg-white px-5 py-8 text-center ring-1 ring-black/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                    <p className="text-[15px] font-medium text-black">
                      {filter === "PENDING"
                        ? "No requests waiting for approval"
                        : "No requests awaiting handover"}
                    </p>
                    <p className="mt-1 text-[13.5px] text-[#5E5E5A]">
                      Switch back to All to inspect every assigned request.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("ALL");
                        setPage(1);
                      }}
                      className="mt-4 inline-flex min-h-[40px] items-center rounded-full bg-[#F3F3EF] px-4 text-[13.5px] font-medium text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
                    >
                      Show All ({requests.length})
                    </button>
                  </div>
                ) : (
                  <>
                    {/* On medium/split-screen (md..lg), cards sit in a clean 1-to-3 column row; on xl+, vertical stack */}
                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-3">
                      {paginatedRequests.map((req) => {
                        const reqNum = requestIndexMap.get(req.id) ?? 0;
                        const palette =
                          FLOW_PALETTES[reqNum % FLOW_PALETTES.length];
                        const isCurrent = isRequestSelected(req.id);
                        const totalUnits = req.items.reduce(
                          (sum, it) => sum + it.requestedQuantity,
                          0
                        );

                        return (
                          <button
                            key={req.id}
                            type="button"
                            onClick={(e) => handleSelectRequest(req.id, e)}
                            title="Click to inspect, Ctrl+Click to pin multiple requests on board"
                            style={
                              isCurrent
                                ? { backgroundColor: palette.banner }
                                : undefined
                            }
                            className={`w-full min-w-0 rounded-[22px] p-4 text-left transition-all duration-200 cursor-pointer ${
                              isCurrent
                                ? "ring-2 ring-black/85 shadow-[0_12px_28px_rgba(0,0,0,0.09)]"
                                : "bg-white/95 ring-1 ring-black/[0.05] shadow-[0_6px_22px_rgba(0,0,0,0.04)] hover:bg-white hover:shadow-[0_10px_28px_rgba(0,0,0,0.07)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-[15.5px] font-semibold tracking-[-0.02em] text-black truncate">
                                  {req.student.fullName}
                                </p>
                                <p className="mt-0.5 text-[12.5px] text-black/60 truncate tabular-nums">
                                  {req.student.institutionalId} ·{" "}
                                  {formatShortDate(req.createdAt)}
                                </p>
                              </div>

                              <span
                                title={getShortStatusLabel(req.status)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-black ring-1 ring-black/10"
                              >
                                {renderStatusIcon(req.status)}
                              </span>
                            </div>

                            {/* Clean Bottom Row: Stacked Thumbnails + Part Count & Status */}
                            <div className="mt-3.5 flex items-center justify-between gap-2.5">
                              <div className="flex shrink-0 items-center -space-x-2">
                                {req.items.slice(0, 3).map((it) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={it.id}
                                    src={
                                      it.item.imageUrl ||
                                      getPartImageUrl(it.item.code)
                                    }
                                    alt={it.item.name}
                                    className="h-8 w-8 rounded-[10px] border-2 border-white bg-[#F5F5F2] object-cover"
                                  />
                                ))}
                                {req.items.length > 3 && (
                                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border-2 border-white bg-black text-[11.5px] font-semibold text-[#C4F041] tabular-nums">
                                    +{req.items.length - 3}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 text-right">
                                <p className="text-[13px] font-medium text-black truncate tabular-nums">
                                  {req.items.length} part
                                  {req.items.length === 1 ? "" : "s"} ·{" "}
                                  {totalUnits} qty
                                </p>
                                <p className="text-[12.5px] text-black/60 truncate">
                                  {getShortStatusLabel(req.status)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Clean Soft Pager Bar */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between gap-2 rounded-full bg-white/95 px-2.5 py-1.5 ring-1 ring-black/[0.05] shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Previous requests"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F2F2EE] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                          {rangeStart}–{rangeEnd} of {filteredRequests.length}
                        </span>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          aria-label="Next requests"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F2F2EE] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* DETAIL + FLOWCHART WORKSPACE (Single or Multi-Pinned via Ctrl+Click) */}
              <div
                ref={detailPanelRef}
                className="xl:col-span-8 flex flex-col min-w-0 space-y-5 scroll-mt-4"
              >
                {activeRequests.length === 0 ? (
                  <div
                    data-canvas-controls="true"
                    className="w-full rounded-[28px] bg-white p-8 sm:p-10 text-center ring-1 ring-black/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.05)]"
                  >
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C4F041] text-black">
                      <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
                    </div>
                    <h3 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
                      All clear in this view
                    </h3>
                    <p className="mt-2 text-[14px] text-[#5E5E5A] max-w-md mx-auto leading-relaxed">
                      Switch to All to review every student request flowchart.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("ALL");
                          setPage(1);
                        }}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#C4F041] px-6 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] cursor-pointer"
                      >
                        View All ({requests.length})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      isMultiMode
                        ? "grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start"
                        : "flex flex-col space-y-5"
                    }
                  >
                    {activeRequests.map((activeRequest) => {
                      const activeRequestNumber =
                        requestIndexMap.get(activeRequest.id) ?? 0;
                      const endorsementNote = notesByReq[activeRequest.id] ?? "";
                      const rejectOpen = Boolean(rejectOpenByReq[activeRequest.id]);
                      const rejectReason =
                        rejectReasonByReq[activeRequest.id] ?? "";

                      return (
                        <div
                          key={activeRequest.id}
                          className="relative flex flex-col min-w-0 space-y-4"
                        >
                          {isMultiMode && (
                            <button
                              type="button"
                              onClick={() => unpinRequest(activeRequest.id)}
                              aria-label={`Unpin ${activeRequest.requestCode}`}
                              title="Unpin from board"
                              className="absolute right-3.5 top-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F2] text-black transition-colors hover:bg-black hover:text-[#C4F041] cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}

                          {/* SOFT INLINE DECISION / VALIDATION CARD */}
                          <div data-canvas-controls="true" className="w-full min-w-0">
                            {/* Stage 1: Pending Instructor Approval */}
                            {activeRequest.status === "PENDING_INSTRUCTOR" && (
                              <div className="rounded-[26px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_12px_36px_rgba(0,0,0,0.055)] space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-black">
                                        {activeRequest.student.fullName}
                                      </h2>
                                      <span className="text-[13px] font-medium text-[#6B6B66] tabular-nums">
                                        {activeRequest.student.institutionalId}
                                      </span>
                                      <span className="font-mono text-[12.5px] text-black/45">
                                        {activeRequest.requestCode}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[14px] text-[#5E5E5A] leading-relaxed">
                                      {activeRequest.purpose ||
                                        "Campus laboratory equipment borrowing request"}
                                    </p>
                                  </div>

                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7DC] px-3 py-1.5 text-[13px] font-medium text-[#6B4E00] shrink-0">
                                    <Clock className="h-3.5 w-3.5" />
                                    Awaiting approval
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                  <input
                                    type="text"
                                    value={endorsementNote}
                                    onChange={(e) =>
                                      setNotesByReq((prev) => ({
                                        ...prev,
                                        [activeRequest.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Optional approval note for student..."
                                    aria-label="Optional approval note"
                                    className="h-11 flex-1 min-w-0 rounded-full border border-transparent bg-[#F5F5F2] px-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 transition-colors focus:border-black/20 focus:bg-white focus:outline-none"
                                  />

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={busyId === activeRequest.id}
                                      onClick={() =>
                                        handleInstructorDecision(
                                          activeRequest,
                                          "APPROVED",
                                          endorsementNote
                                        )
                                      }
                                      className="inline-flex h-11 flex-1 sm:flex-initial items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#C4F041] px-5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:opacity-50 cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                                      <span>
                                        {busyId === activeRequest.id
                                          ? "Approving..."
                                          : "Accept & Approve"}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={busyId === activeRequest.id}
                                      onClick={() => {
                                        const nextOpen = !rejectOpen;
                                        setRejectOpenByReq((prev) => ({
                                          ...prev,
                                          [activeRequest.id]: nextOpen,
                                        }));
                                        if (nextOpen && endorsementNote.trim()) {
                                          setRejectReasonByReq((prev) => ({
                                            ...prev,
                                            [activeRequest.id]:
                                              endorsementNote.trim(),
                                          }));
                                        }
                                      }}
                                      className={`inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-medium text-black transition-colors cursor-pointer ${
                                        rejectOpen
                                          ? "bg-[#FDE8E1] text-[#A23315]"
                                          : "bg-[#F5F5F2] hover:bg-[#FDE8E1] hover:text-[#A23315]"
                                      }`}
                                    >
                                      <XCircle className="h-4 w-4 shrink-0" />
                                      <span>Reject</span>
                                    </button>
                                  </div>
                                </div>

                                <AnimatePresence initial={false}>
                                  {rejectOpen && (
                                    <motion.div
                                      key="inline-reject-panel"
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.28, ease: LP_EASE }}
                                      className="overflow-hidden"
                                    >
                                      <div className="rounded-[18px] bg-[#FFF5F2] p-3.5 space-y-2.5 ring-1 ring-[#FA8E66]/35">
                                        <p className="text-[13px] font-medium text-[#8C2B10]">
                                          Reason for rejecting{" "}
                                          {activeRequest.student.fullName}&apos;s
                                          request
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                          <input
                                            type="text"
                                            value={rejectReason}
                                            onChange={(e) =>
                                              setRejectReasonByReq((prev) => ({
                                                ...prev,
                                                [activeRequest.id]:
                                                  e.target.value,
                                              }))
                                            }
                                            placeholder="e.g., Limit to 1 unit per lab group..."
                                            aria-label="Rejection reason"
                                            className="h-11 flex-1 rounded-full border border-black/10 bg-white px-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black/30 focus:outline-none"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={
                                                busyId === activeRequest.id ||
                                                rejectReason.trim().length < 3
                                              }
                                              onClick={() =>
                                                handleInstructorDecision(
                                                  activeRequest,
                                                  "REJECTED",
                                                  rejectReason
                                                )
                                              }
                                              className="inline-flex h-11 flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full bg-[#FA8E66] px-4 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#FA8E66] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                              Confirm Reject
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRejectOpenByReq((prev) => ({
                                                  ...prev,
                                                  [activeRequest.id]: false,
                                                }));
                                                setRejectReasonByReq((prev) => ({
                                                  ...prev,
                                                  [activeRequest.id]: "",
                                                }));
                                              }}
                                              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-[13.5px] font-medium text-[#5E5E5A] hover:text-black cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {/* Stage 2: Approved — 4-Angle Collection Photo Readiness + Handover */}
                            {(activeRequest.status === "APPROVED" ||
                              activeRequest.status === "PARTIALLY_ISSUED") &&
                              (() => {
                                const allPhotosReady = activeRequest.items.every(
                                  (it) => countCollectionPhotos(it) === 4
                                );
                                return (
                                  <div className="rounded-[26px] bg-white p-5 sm:p-6 ring-1 ring-black/[0.05] shadow-[0_12px_36px_rgba(0,0,0,0.055)] space-y-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-black">
                                            {activeRequest.student.fullName}
                                          </h2>
                                          <span className="text-[13px] font-medium text-[#6B6B66] tabular-nums">
                                            {activeRequest.student.institutionalId}
                                          </span>
                                          <span className="font-mono text-[12.5px] text-black/45">
                                            {activeRequest.requestCode}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[14px] text-[#5E5E5A]">
                                          Approved &amp; stock reserved · Check all 4 collection photos before handover.
                                        </p>
                                      </div>

                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium shrink-0 ${
                                          allPhotosReady
                                            ? "bg-[#EAF8BD] text-[#2F4A08]"
                                            : "bg-[#FFF7DC] text-[#6B4E00]"
                                        }`}
                                      >
                                        <Camera className="h-3.5 w-3.5" />
                                        {allPhotosReady
                                          ? "4-angle photos ready"
                                          : "Photos incomplete"}
                                      </span>
                                    </div>

                                    <div className="space-y-2.5">
                                      {activeRequest.items.map((it) => {
                                        const count = countCollectionPhotos(it);
                                        const missing =
                                          getMissingCollectionAngles(it);
                                        const collectionPhotos = (
                                          it.photos ?? []
                                        ).filter((p) => p.phase === "COLLECTION");

                                        return (
                                          <div
                                            key={it.id}
                                            className="rounded-[18px] bg-[#F5F5F2] p-3.5 space-y-2.5"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                  src={
                                                    it.item.imageUrl ||
                                                    getPartImageUrl(it.item.code)
                                                  }
                                                  alt={it.item.name}
                                                  className="h-10 w-10 shrink-0 rounded-[12px] bg-white object-cover"
                                                />
                                                <div className="min-w-0">
                                                  <p className="text-[14px] font-semibold text-black truncate">
                                                    {it.item.name}
                                                  </p>
                                                  <p className="text-[13px] text-[#5E5E5A] tabular-nums">
                                                    Qty:{" "}
                                                    {it.approvedQuantity ||
                                                      it.requestedQuantity}{" "}
                                                    {it.item.unit}
                                                  </p>
                                                </div>
                                              </div>

                                              <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ${
                                                  count === 4
                                                    ? "bg-[#C4F041] text-black"
                                                    : "bg-white text-[#5E5E5A]"
                                                }`}
                                              >
                                                {count}/4 angles
                                              </span>
                                            </div>

                                            {missing.length > 0 && (
                                              <p className="text-[13px] text-[#5E5E5A]">
                                                Missing:{" "}
                                                <span className="font-medium text-black">
                                                  {missing
                                                    .map((a) => ANGLE_LABELS[a])
                                                    .join(", ")}
                                                </span>
                                              </p>
                                            )}

                                            {collectionPhotos.length > 0 && (
                                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {collectionPhotos.map((p) => (
                                                  <div
                                                    key={p.id}
                                                    className="overflow-hidden rounded-[12px] bg-white"
                                                  >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                      src={p.url}
                                                      alt={ANGLE_LABELS[p.angle]}
                                                      className="aspect-[4/3] w-full object-cover"
                                                    />
                                                    <p className="px-2 py-1 text-center text-[12px] font-medium text-[#5E5E5A] truncate">
                                                      {ANGLE_LABELS[p.angle]}
                                                    </p>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <button
                                        type="button"
                                        disabled={busyId === activeRequest.id}
                                        onClick={() =>
                                          handleConfirmHandover(activeRequest)
                                        }
                                        className={`inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[14px] font-semibold transition-colors cursor-pointer ${
                                          allPhotosReady
                                            ? "bg-[#C4F041] text-black hover:bg-black hover:text-[#C4F041]"
                                            : "bg-[#F2F2EE] text-black/65 hover:bg-[#E7E7E2]"
                                        }`}
                                      >
                                        <PackageCheck className="h-4 w-4 shrink-0" />
                                        <span>
                                          {busyId === activeRequest.id
                                            ? "Confirming..."
                                            : "Confirm Physical Handover"}
                                        </span>
                                      </button>

                                      <Link
                                        href="/instructor/requests"
                                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#5E5E5A] hover:text-black"
                                      >
                                        Full handover detail
                                        <ArrowRight className="h-3.5 w-3.5" />
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })()}

                            {/* Return Verification Pending / Submitted */}
                            {(activeRequest.status ===
                              "RETURN_VERIFICATION_PENDING" ||
                              activeRequest.status === "RETURN_SUBMITTED") && (
                              <div className="rounded-[26px] bg-[#FAFDF0] p-5 sm:p-6 pr-12 ring-1 ring-[#9BC724]/35 shadow-[0_12px_36px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-black">
                                      {activeRequest.student.fullName}
                                    </h2>
                                    <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                                      {activeRequest.student.institutionalId}
                                    </span>
                                  </div>
                                  <p className="text-[14px] text-black/70">
                                    Return submitted (
                                    <span className="font-semibold text-black tabular-nums">
                                      {countReturnPhotos(activeRequest)} photos
                                    </span>
                                    ) — compare side-by-side to close.
                                  </p>
                                </div>

                                <Link
                                  href="/instructor/return-verification"
                                  className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#C4F041] px-5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041]"
                                >
                                  <span>Inspect &amp; Validate</span>
                                  <ArrowRight className="h-4 w-4 shrink-0" />
                                </Link>
                              </div>
                            )}

                            {/* Other Statuses Summary */}
                            {activeRequest.status !== "PENDING_INSTRUCTOR" &&
                              activeRequest.status !== "APPROVED" &&
                              activeRequest.status !== "PARTIALLY_ISSUED" &&
                              activeRequest.status !==
                                "RETURN_VERIFICATION_PENDING" &&
                              activeRequest.status !== "RETURN_SUBMITTED" && (
                                <div className="rounded-[24px] bg-white px-5 py-4 pr-12 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                      <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-black">
                                        {activeRequest.student.fullName}
                                      </h2>
                                      <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                                        {activeRequest.student.institutionalId}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[13.5px] text-[#5E5E5A] truncate">
                                      {activeRequest.rejectionReason
                                        ? `Rejection note: ${activeRequest.rejectionReason}`
                                        : activeRequest.purpose}
                                    </p>
                                  </div>

                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F2] px-3 py-1.5 text-[13px] font-medium text-black shrink-0">
                                    {renderStatusIcon(activeRequest.status)}
                                    {getShortStatusLabel(activeRequest.status)}
                                  </span>
                                </div>
                              )}
                          </div>

                          {/* ORGANIC EXCALIDRAW REQUEST FLOWCHART */}
                          <CanvasDraggableItem className="w-full">
                            <RequestFlowchartCard
                              request={activeRequest}
                              index={activeRequestNumber}
                              compactMode={isMultiMode}
                              defaultExpanded={false}
                            />
                          </CanvasDraggableItem>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DottedGridCanvas>
    </div>
  );
}
