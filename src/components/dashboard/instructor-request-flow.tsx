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
  ClipboardCheck,
  Clock,
  Layers,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
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
      return "Needs Approval";
    case "PENDING_LAB_MANAGER":
      return "With Lab Manager";
    case "APPROVED":
    case "PARTIALLY_ISSUED":
      return "Ready for Handover";
    case "ISSUED":
    case "RETURN_PENDING":
      return "Issued";
    case "RETURN_SUBMITTED":
    case "RETURN_VERIFICATION_PENDING":
      return "Return to Validate";
    case "RETURN_DISPUTED":
      return "Return Disputed";
    case "PARTIALLY_RETURNED":
      return "Partially Returned";
    case "CLOSED":
      return "Completed";
    case "REJECTED_BY_INSTRUCTOR":
    case "REJECTED_BY_LAB_MANAGER":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
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
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );

  // Inline decision controls state
  const [endorsementNote, setEndorsementNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
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

  // Sync Lenis scroll dimensions when request list or inline reject box changes
  useEffect(() => {
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [requests.length, filter, page, rejectOpen, selectedRequestId, lenis]);

  // Sort requests with actionable instructor items surfaced first
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const prioDiff =
        getRequestPriority(a.status) - getRequestPriority(b.status);
      if (prioDiff !== 0) return prioDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests]);

  // Stable visual index map so each request keeps its palette color across filter switches
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

  // Keep active request synchronized with the filtered queue
  const activeRequest = useMemo(() => {
    if (filteredRequests.length === 0) return null;
    return (
      filteredRequests.find((r) => r.id === selectedRequestId) ??
      filteredRequests[0]
    );
  }, [filteredRequests, selectedRequestId]);

  const activeRequestNumber = useMemo(() => {
    if (!activeRequest) return 0;
    return requestIndexMap.get(activeRequest.id) ?? 0;
  }, [activeRequest, requestIndexMap]);

  // Reset inline decision inputs whenever the selected request changes
  useEffect(() => {
    setEndorsementNote("");
    setRejectOpen(false);
    setRejectReason("");
  }, [activeRequest?.id]);

  const handleSelectRequest = (reqId: string) => {
    setSelectedRequestId(reqId);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
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
        decision === "APPROVED"
          ? "PENDING_LAB_MANAGER"
          : "REJECTED_BY_INSTRUCTOR",
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
          ? `${req.requestCode} approved & forwarded to Campus Lab Manager`
          : `${req.requestCode} rejected and student notified`
      );
      setEndorsementNote("");
      setRejectOpen(false);
      setRejectReason("");
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
      return <Check className="h-3.5 w-3.5 stroke-[2.6]" />;
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
      className="w-full min-w-0"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <DottedGridCanvas pannable className="flex flex-col">
        {isBoardEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: LP_EASE }}
            className="flex flex-1 min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100vh-8.5rem)] items-center justify-center p-4 pb-20 sm:p-8"
          >
            <div
              data-canvas-controls="true"
              className="w-full max-w-xl rounded-[24px] border border-black/14 bg-white p-6 sm:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-[#C4F041] text-black shadow-[3px_3px_0px_#000000]">
                <CheckCircle2 className="h-7 w-7 stroke-[2.2]" />
              </div>
              <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.03em] text-black leading-[1.1]">
                All student requests caught up!
              </h2>
              <p className="mt-3 text-[14px] sm:text-[15px] text-[#5E5E5A] leading-relaxed">
                New borrowing requests assigned to you will appear live on this
                board with their full approval flowchart.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <LoopsiiButton
                  label="Browse Campus Inventory"
                  href="/instructor/inventory"
                  hideArrow
                  className="w-full sm:w-auto [&>span]:w-full sm:[&>span]:w-auto [&>span]:justify-center"
                />
                <Link
                  href="/instructor/return-verification"
                  className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-black/16 bg-[#F7F7F5] px-6 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                >
                  Validate Returns
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: LP_EASE }}
            className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 p-4 pb-20 sm:p-6 sm:pb-24 lg:p-8 lg:pb-20 items-start min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100vh-8.5rem)]"
          >
            {/* LEFT COLUMN (lg:col-span-5): Instructor Action Hub & Live Queue */}
            <div className="lg:col-span-5 min-w-0 lg:sticky lg:top-6">
              <div
                data-canvas-controls="true"
                className="w-full rounded-[20px] sm:rounded-[24px] border border-black/14 bg-white p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)] space-y-5"
              >
                {/* Editorial Heading */}
                <div>
                  <h2 className="text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black leading-[1.12]">
                    Review &amp; validate student requests
                  </h2>
                  <p className="mt-1.5 text-[14px] text-[#5E5E5A] leading-relaxed">
                    Approve requests, verify 4-angle handover photos, and inspect
                    lab returns in real time.
                  </p>
                </div>

                {/* 3-Stat Mini Strip */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("PENDING");
                      setPage(1);
                    }}
                    className={`min-h-[76px] min-w-0 rounded-[16px] border p-2.5 sm:p-3 text-left transition-all cursor-pointer ${
                      filter === "PENDING"
                        ? "border-black bg-[#FFF9E6] shadow-[2px_2px_0px_#000000]"
                        : "border-black/12 bg-[#F7F7F5] hover:border-black/45"
                    }`}
                  >
                    <p className="text-[22px] sm:text-[24px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                      {loading ? "–" : pendingCount}
                    </p>
                    <p className="mt-2 text-[12px] sm:text-[13px] font-medium leading-tight text-[#5E5E5A] break-words">
                      Pending Approval
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilter("HANDOVER");
                      setPage(1);
                    }}
                    className={`min-h-[76px] min-w-0 rounded-[16px] border p-2.5 sm:p-3 text-left transition-all cursor-pointer ${
                      filter === "HANDOVER"
                        ? "border-black bg-[#BCE6FA]/55 shadow-[2px_2px_0px_#000000]"
                        : "border-black/12 bg-[#F7F7F5] hover:border-black/45"
                    }`}
                  >
                    <p className="text-[22px] sm:text-[24px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                      {loading ? "–" : handoverCount}
                    </p>
                    <p className="mt-2 text-[12px] sm:text-[13px] font-medium leading-tight text-[#5E5E5A] break-words">
                      Ready for Handover
                    </p>
                  </button>

                  <Link
                    href="/instructor/return-verification"
                    className={`min-h-[76px] min-w-0 rounded-[16px] border p-2.5 sm:p-3 text-left transition-all block ${
                      returnsToValidateCount > 0
                        ? "border-black/30 bg-[#C4F041]/30 hover:border-black hover:bg-[#C4F041]/60"
                        : "border-black/12 bg-[#F7F7F5] hover:border-black/45"
                    }`}
                  >
                    <p className="text-[22px] sm:text-[24px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                      {loading ? "–" : returnsToValidateCount}
                    </p>
                    <p className="mt-2 text-[12px] sm:text-[13px] font-medium leading-tight text-[#5E5E5A] break-words">
                      Returns to Validate
                    </p>
                  </Link>
                </div>

                {/* Interactive Queue Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      {
                        key: "PENDING" as const,
                        label: "Needs Approval",
                        count: pendingCount,
                      },
                      {
                        key: "HANDOVER" as const,
                        label: "Confirm Handover",
                        count: handoverCount,
                      },
                      {
                        key: "ALL" as const,
                        label: "All Active",
                        count: requests.length,
                      },
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
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                          active
                            ? "border-black bg-black text-[#C4F041]"
                            : "border-black/15 bg-white text-black hover:border-black/50 hover:bg-[#F5F5F3]"
                        }`}
                      >
                        <span>{pill.label}</span>
                        <span
                          className={`tabular-nums ${
                            active ? "text-[#C4F041]/90" : "text-black/55"
                          }`}
                        >
                          ({pill.count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Compact Paginated Queue (3 per page, zero inner scrollbar) */}
                <div className="space-y-2.5">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="rounded-[16px] border border-black/12 bg-[#F7F7F5] p-3.5 space-y-2.5"
                      >
                        <div className="lp-shimmer h-4 w-40 rounded-md" />
                        <div className="lp-shimmer h-3.5 w-28 rounded-md" />
                      </div>
                    ))
                  ) : paginatedRequests.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-black/20 bg-[#F7F7F5] px-4 py-7 text-center">
                      <p className="text-[15px] font-medium text-black">
                        {filter === "PENDING"
                          ? "No requests waiting for approval"
                          : "No requests awaiting handover"}
                      </p>
                      <p className="mt-1 text-[13px] text-[#5E5E5A]">
                        Switch to All Active to inspect every assigned request
                        flowchart.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("ALL");
                          setPage(1);
                        }}
                        className="mt-3.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-black/20 bg-white px-4 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041] cursor-pointer"
                      >
                        Show All Active ({requests.length})
                      </button>
                    </div>
                  ) : (
                    paginatedRequests.map((req) => {
                      const reqNum = requestIndexMap.get(req.id) ?? 0;
                      const palette =
                        FLOW_PALETTES[reqNum % FLOW_PALETTES.length];
                      const isCurrent = activeRequest?.id === req.id;
                      const totalUnits = req.items.reduce(
                        (sum, it) => sum + it.requestedQuantity,
                        0
                      );

                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => handleSelectRequest(req.id)}
                          style={{
                            backgroundColor: isCurrent
                              ? palette.banner
                              : "#FFFFFF",
                          }}
                          className={`w-full rounded-[16px] border-2 p-3.5 text-left transition-all duration-200 cursor-pointer ${
                            isCurrent
                              ? "border-black shadow-[4px_4px_0px_#000000] -translate-y-0.5"
                              : "border-black/15 hover:border-black/55"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <p className="text-[15px] font-semibold text-black truncate">
                                  {req.student.fullName}
                                </p>
                                <span className="text-[13px] font-medium text-black/65 tabular-nums">
                                  {req.student.institutionalId}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[13px] text-black/70 truncate">
                                {req.purpose || req.requestCode}
                              </p>
                            </div>

                            <span
                              title={getShortStatusLabel(req.status)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/30 bg-white/90 text-black"
                            >
                              {renderStatusIcon(req.status)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            {/* Stacked WebP Hardware Thumbnails */}
                            <div className="flex items-center min-w-0">
                              <div className="flex items-center -space-x-2">
                                {req.items.slice(0, 3).map((it) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={it.id}
                                    src={
                                      it.item.imageUrl ||
                                      getPartImageUrl(it.item.code)
                                    }
                                    alt={it.item.name}
                                    className="h-8 w-8 rounded-[9px] border-2 border-white bg-[#F5F5F3] object-cover shadow-sm"
                                  />
                                ))}
                                {req.items.length > 3 && (
                                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border-2 border-white bg-black text-[12px] font-semibold text-[#C4F041] tabular-nums">
                                    +{req.items.length - 3}
                                  </span>
                                )}
                              </div>
                              <span className="ml-2.5 text-[13px] font-medium text-black/75 tabular-nums truncate">
                                {req.items.length} part
                                {req.items.length === 1 ? "" : "s"} ·{" "}
                                {totalUnits} qty
                              </span>
                            </div>

                            <span className="shrink-0 rounded-full border border-black/20 bg-white/85 px-2.5 py-0.5 text-[12px] font-semibold text-black">
                              {getShortStatusLabel(req.status)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Pagination Bar */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-black/15 bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
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
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-black/15 bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Quick-Links Hub */}
                <div className="border-t border-black/10 pt-4 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Link
                      href="/instructor/return-verification"
                      className="inline-flex min-h-[42px] items-center justify-between gap-2 rounded-[14px] border border-black/16 bg-[#F7F7F5] px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <RotateCcw className="h-4 w-4 shrink-0" />
                        Validate Returns
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>

                    <Link
                      href="/instructor/inventory"
                      className="inline-flex min-h-[42px] items-center justify-between gap-2 rounded-[14px] border border-black/16 bg-[#F7F7F5] px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Layers className="h-4 w-4 shrink-0" />
                        Campus Inventory
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/instructor/requests"
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[12px] border border-black/12 bg-white px-3 text-[13px] font-medium text-[#5E5E5A] transition-colors hover:border-black/45 hover:text-black"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Full Queue</span>
                    </Link>
                    <Link
                      href="/instructor/tickets"
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[12px] border border-black/12 bg-white px-3 text-[13px] font-medium text-[#5E5E5A] transition-colors hover:border-black/45 hover:text-black"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Issue Tickets</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (lg:col-span-7): Selected Request Flowchart + Inline Accept / Reject / Validate Controls */}
            <div
              ref={detailPanelRef}
              className="lg:col-span-7 flex flex-col min-w-0 space-y-5 scroll-mt-4"
            >
              {!activeRequest ? (
                <div
                  data-canvas-controls="true"
                  className="w-full rounded-[24px] border border-black/14 bg-white p-7 sm:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-[#C4F041] text-black shadow-[3px_3px_0px_#000000]">
                    <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
                  </div>
                  <h3 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
                    All student requests caught up!
                  </h3>
                  <p className="mt-2 text-[14px] text-[#5E5E5A] max-w-md mx-auto leading-relaxed">
                    There are no requests in this filter right now. Inspect all
                    active requests or browse campus stock below.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("ALL");
                        setPage(1);
                      }}
                      className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center rounded-full border-2 border-black bg-[#C4F041] px-6 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] cursor-pointer"
                    >
                      View All Active ({requests.length})
                    </button>
                    <LoopsiiButton
                      label="Browse Campus Inventory"
                      href="/instructor/inventory"
                      size="md"
                      hideArrow
                      className="w-full sm:w-auto [&>span]:w-full sm:[&>span]:w-auto [&>span]:justify-center"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* INLINE DECISION / VALIDATION CONTROL CARD */}
                  <div data-canvas-controls="true" className="w-full min-w-0">
                    {/* Stage 1: Pending Instructor Approval */}
                    {activeRequest.status === "PENDING_INSTRUCTOR" && (
                      <div className="rounded-[22px] border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000000] space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <h3 className="text-[17px] sm:text-[18px] font-semibold tracking-[-0.02em] text-black">
                                {activeRequest.student.fullName}
                              </h3>
                              <span className="rounded-full border border-black/20 bg-[#F7F7F5] px-2.5 py-0.5 text-[13px] font-medium text-black/75 tabular-nums">
                                {activeRequest.student.institutionalId}
                              </span>
                              <span className="font-mono text-[13px] text-[#5E5E5A]">
                                {activeRequest.requestCode}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[14px] text-[#5E5E5A] leading-snug break-words">
                              {activeRequest.purpose ||
                                "Campus laboratory equipment borrowing request"}
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#FFF9E6] px-3 py-1 text-[13px] font-semibold text-black shrink-0">
                            <Clock className="h-3.5 w-3.5" />
                            Awaiting Your Decision
                          </span>
                        </div>

                        {/* Optional endorsement note */}
                        <input
                          type="text"
                          value={endorsementNote}
                          onChange={(e) => setEndorsementNote(e.target.value)}
                          placeholder="Add an optional endorsement note for the Lab Manager..."
                          aria-label="Optional endorsement note"
                          className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] px-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/45 focus:border-black focus:bg-white focus:outline-none transition-colors"
                        />

                        {/* Primary Accept / Reject Actions */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 py-2 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                              {busyId === activeRequest.id
                                ? "Forwarding..."
                                : "Accept & Forward to Lab Manager"}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={busyId === activeRequest.id}
                            onClick={() => {
                              setRejectOpen((prev) => !prev);
                              if (!rejectOpen && endorsementNote.trim()) {
                                setRejectReason(endorsementNote.trim());
                              }
                            }}
                            className={`inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 px-5 py-2 text-[14px] font-semibold text-black transition-colors cursor-pointer ${
                              rejectOpen
                                ? "border-black bg-[#FFF5F3]"
                                : "border-black/25 bg-white hover:border-black hover:bg-[#FFF5F3]"
                            }`}
                          >
                            <XCircle className="h-4 w-4 shrink-0 text-[#E0532C]" />
                            <span>Reject</span>
                          </button>
                        </div>

                        {/* Inline 2-Tap Rejection Reason Confirm Bar */}
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
                              <div className="rounded-[16px] border-2 border-black/20 bg-[#FFF5F3] p-3.5 space-y-2.5">
                                <p className="text-[13px] font-semibold text-black">
                                  Share a brief rejection reason with{" "}
                                  {activeRequest.student.fullName}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) =>
                                      setRejectReason(e.target.value)
                                    }
                                    placeholder="e.g., Please limit to 1 unit per lab group..."
                                    aria-label="Rejection reason"
                                    className="h-11 flex-1 rounded-full border border-black/25 bg-white px-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
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
                                      className="inline-flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center rounded-full border-2 border-black bg-[#FA8E66] px-4 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#FA8E66] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      Confirm Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectOpen(false);
                                        setRejectReason("");
                                      }}
                                      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-black/20 bg-white px-4 text-[13px] font-medium text-black hover:border-black cursor-pointer"
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

                    {/* Stage 3: Lab Manager Approved — 4-Angle Collection Photo Readiness + Physical Handover */}
                    {(activeRequest.status === "APPROVED" ||
                      activeRequest.status === "PARTIALLY_ISSUED") &&
                      (() => {
                        const allPhotosReady = activeRequest.items.every(
                          (it) => countCollectionPhotos(it) === 4
                        );
                        return (
                          <div className="rounded-[22px] border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000000] space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                  <h3 className="text-[17px] sm:text-[18px] font-semibold tracking-[-0.02em] text-black">
                                    {activeRequest.student.fullName}
                                  </h3>
                                  <span className="rounded-full border border-black/20 bg-[#F7F7F5] px-2.5 py-0.5 text-[13px] font-medium text-black/75 tabular-nums">
                                    {activeRequest.student.institutionalId}
                                  </span>
                                  <span className="font-mono text-[13px] text-[#5E5E5A]">
                                    {activeRequest.requestCode}
                                  </span>
                                </div>
                                <p className="mt-1 text-[14px] text-[#5E5E5A]">
                                  Stock reserved by Lab Manager · Verify all 4
                                  collection photo angles per item before
                                  handover.
                                </p>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1 text-[13px] font-semibold text-black shrink-0 ${
                                  allPhotosReady
                                    ? "bg-[#C4F041]"
                                    : "bg-[#FFF9E6]"
                                }`}
                              >
                                <Camera className="h-3.5 w-3.5" />
                                {allPhotosReady
                                  ? "4-Angle Photos Ready"
                                  : "Photos Incomplete"}
                              </span>
                            </div>

                            {/* Per-Item 4-Angle Photo Checklist */}
                            <div className="space-y-2.5">
                              {activeRequest.items.map((it) => {
                                const count = countCollectionPhotos(it);
                                const missing = getMissingCollectionAngles(it);
                                const collectionPhotos = (
                                  it.photos ?? []
                                ).filter((p) => p.phase === "COLLECTION");

                                return (
                                  <div
                                    key={it.id}
                                    className="rounded-[16px] border border-black/14 bg-[#F7F7F5] p-3 space-y-2.5"
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
                                          className="h-10 w-10 shrink-0 rounded-[10px] border border-black/12 bg-white object-cover"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-[14px] font-semibold text-black truncate">
                                            {it.item.name}
                                          </p>
                                          <p className="text-[13px] text-[#5E5E5A] tabular-nums">
                                            Approved Qty:{" "}
                                            {it.approvedQuantity ||
                                              it.requestedQuantity}{" "}
                                            {it.item.unit}
                                          </p>
                                        </div>
                                      </div>

                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-semibold tabular-nums ${
                                          count === 4
                                            ? "border-black bg-[#C4F041] text-black"
                                            : "border-black/25 bg-white text-black"
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
                                            className="overflow-hidden rounded-[10px] border border-black/12 bg-white"
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
                                className={`inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 px-6 py-2 text-[14px] font-semibold transition-colors cursor-pointer ${
                                  allPhotosReady
                                    ? "border-black bg-[#C4F041] text-black hover:bg-black hover:text-[#C4F041]"
                                    : "border-black/30 bg-[#F2F2EF] text-black/75 hover:border-black"
                                }`}
                              >
                                <PackageCheck className="h-4 w-4 shrink-0" />
                                <span>
                                  {busyId === activeRequest.id
                                    ? "Confirming Handover..."
                                    : "Confirm Physical Handover"}
                                </span>
                              </button>

                              <Link
                                href="/instructor/requests"
                                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 text-[13px] font-medium text-[#5E5E5A] hover:text-black underline decoration-black/25 underline-offset-4"
                              >
                                Open full handover detail
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Return Verification Pending / Submitted */}
                    {(activeRequest.status === "RETURN_VERIFICATION_PENDING" ||
                      activeRequest.status === "RETURN_SUBMITTED") && (
                      <div className="rounded-[22px] border-2 border-black bg-[#F9FDE8] p-4 sm:p-5 shadow-[4px_4px_0px_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <h3 className="text-[17px] sm:text-[18px] font-semibold tracking-[-0.02em] text-black">
                              {activeRequest.student.fullName}
                            </h3>
                            <span className="rounded-full border border-black/20 bg-white px-2.5 py-0.5 text-[13px] font-medium text-black/75 tabular-nums">
                              {activeRequest.student.institutionalId}
                            </span>
                            <span className="font-mono text-[13px] text-[#5E5E5A]">
                              {activeRequest.requestCode}
                            </span>
                          </div>
                          <p className="text-[14px] text-black/75">
                            Student submitted return inspection (
                            <span className="font-semibold text-black tabular-nums">
                              {countReturnPhotos(activeRequest)} return photo
                              {countReturnPhotos(activeRequest) === 1
                                ? ""
                                : "s"}
                            </span>
                            ) — compare side-by-side with collection photos to
                            close.
                          </p>
                        </div>

                        <Link
                          href="/instructor/return-verification"
                          className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 py-2 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041]"
                        >
                          <span>Inspect &amp; Validate Return</span>
                          <ArrowRight className="h-4 w-4 shrink-0" />
                        </Link>
                      </div>
                    )}

                    {/* All Other Request Statuses (Informational Summary Bar) */}
                    {activeRequest.status !== "PENDING_INSTRUCTOR" &&
                      activeRequest.status !== "APPROVED" &&
                      activeRequest.status !== "PARTIALLY_ISSUED" &&
                      activeRequest.status !== "RETURN_VERIFICATION_PENDING" &&
                      activeRequest.status !== "RETURN_SUBMITTED" && (
                        <div className="rounded-[20px] border border-black/14 bg-white px-4 py-3.5 sm:px-5 shadow-[0_10px_30px_rgba(0,0,0,0.05)] flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-black">
                                {activeRequest.student.fullName}
                              </h3>
                              <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                                {activeRequest.student.institutionalId}
                              </span>
                              <span className="font-mono text-[13px] text-[#5E5E5A]">
                                {activeRequest.requestCode}
                              </span>
                            </div>
                            {activeRequest.rejectionReason ? (
                              <p className="mt-1 text-[13px] text-black/75 break-words">
                                Rejection note: {activeRequest.rejectionReason}
                              </p>
                            ) : (
                              <p className="mt-1 text-[13px] text-[#5E5E5A] break-words">
                                {activeRequest.purpose}
                              </p>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-[#F7F7F5] px-3 py-1 text-[13px] font-semibold text-black shrink-0">
                            {renderStatusIcon(activeRequest.status)}
                            {getShortStatusLabel(activeRequest.status)}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* ORGANIC EXCALIDRAW REQUEST FLOWCHART */}
                  <CanvasDraggableItem className="w-full">
                    <AnimatePresence mode="wait">
                      <RequestFlowchartCard
                        key={activeRequest.id}
                        request={activeRequest}
                        index={activeRequestNumber}
                        compactMode={false}
                        defaultExpanded={false}
                      />
                    </AnimatePresence>
                  </CanvasDraggableItem>
                </>
              )}
            </div>
          </motion.div>
        )}
      </DottedGridCanvas>
    </div>
  );
}
