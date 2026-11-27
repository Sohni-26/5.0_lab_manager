"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  PackageCheck,
  Search,
  User,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import {
  FLOW_PALETTES,
  RequestFlowchartCard,
} from "@/components/dashboard/request-flowchart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  readMergedDemoRequests,
  upsertLocalStudentRequest,
} from "@/lib/student-requests-store";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type LabRequestStatus,
  type PhotoAngle,
  type RequestApprovalDTO,
} from "@/types/contracts";

type InstructorFilter = "PENDING_REVIEW" | "CONFIRM_HANDOVER" | "ALL_ASSIGNED";

const DECK_PAGE_SIZE = 3;
const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

const HANDOVER_STATUSES: LabRequestStatus[] = ["APPROVED", "PARTIALLY_ISSUED"];

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  FRONT_TOP: "Front / Top",
  BACK_BOTTOM: "Back / Bottom",
  LEFT_SIDE: "Left Side",
  RIGHT_SIDE: "Right Side",
};

interface LightboxState {
  itemName: string;
  itemCode: string;
  studentName: string;
  photos: ItemPhotoDTO[];
  index: number;
}

function getCollectionPhotos(item: LabRequestItemDTO): ItemPhotoDTO[] {
  return (item.photos ?? []).filter((p) => p.phase === "COLLECTION");
}

function countCollectionPhotos(item: LabRequestItemDTO): number {
  const angles = new Set(getCollectionPhotos(item).map((p) => p.angle));
  return REQUIRED_PHOTO_ANGLES.filter((a) => angles.has(a)).length;
}

function getStatusInfo(status: LabRequestStatus): {
  label: string;
  tone: "pending" | "handover" | "completed" | "rejected";
} {
  switch (status) {
    case "PENDING_INSTRUCTOR":
      return { label: "Needs your review", tone: "pending" };
    case "PENDING_LAB_MANAGER":
      return { label: "At Lab Manager", tone: "pending" };
    case "APPROVED":
      return { label: "Ready for handover", tone: "handover" };
    case "PARTIALLY_ISSUED":
      return { label: "Partially issued", tone: "handover" };
    case "ISSUED":
      return { label: "Issued to student", tone: "completed" };
    case "RETURN_PENDING":
    case "RETURN_SUBMITTED":
    case "RETURN_VERIFICATION_PENDING":
    case "RETURN_DISPUTED":
    case "PARTIALLY_RETURNED":
      return { label: "Return in progress", tone: "pending" };
    case "CLOSED":
      return { label: "Closed", tone: "completed" };
    case "REJECTED_BY_INSTRUCTOR":
      return { label: "Rejected by you", tone: "rejected" };
    case "REJECTED_BY_LAB_MANAGER":
      return { label: "Rejected by Lab Mgr", tone: "rejected" };
    default:
      return { label: "Pending", tone: "pending" };
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

export default function InstructorRequestsPage() {
  const { isDemoMode, user } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InstructorFilter>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deckPage, setDeckPage] = useState(0);
  const [showAllDeck, setShowAllDeck] = useState(false);

  const [commentsByReq, setCommentsByReq] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LabRequestDTO | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const detailRef = useRef<HTMLDivElement | null>(null);

  const handleSelectRequest = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const load = useCallback(async () => {
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
    load();
  }, [load]);

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
    onEvent: () => load(),
  });

  // Preserve chronological request numbering matching Student views
  const requestIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((req, idx) => {
      map.set(req.id, requests.length - 1 - idx);
    });
    return map;
  }, [requests]);

  const counts = useMemo(
    () => ({
      PENDING_REVIEW: requests.filter((r) => r.status === "PENDING_INSTRUCTOR")
        .length,
      CONFIRM_HANDOVER: requests.filter((r) =>
        HANDOVER_STATUSES.includes(r.status)
      ).length,
      ALL_ASSIGNED: requests.length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (filter === "PENDING_REVIEW" && req.status !== "PENDING_INSTRUCTOR") {
        return false;
      }
      if (
        filter === "CONFIRM_HANDOVER" &&
        !HANDOVER_STATUSES.includes(req.status)
      ) {
        return false;
      }
      if (!q) return true;
      const reqNum = `request ${(requestIndexMap.get(req.id) ?? 0) + 1}`;
      return (
        reqNum.includes(q) ||
        req.requestCode.toLowerCase().includes(q) ||
        req.student.fullName.toLowerCase().includes(q) ||
        req.student.institutionalId.toLowerCase().includes(q) ||
        req.purpose.toLowerCase().includes(q) ||
        req.items.some(
          (it) =>
            it.item.name.toLowerCase().includes(q) ||
            it.item.code.toLowerCase().includes(q)
        )
      );
    });
  }, [requests, filter, search, requestIndexMap]);

  const activeRequest = useMemo(() => {
    if (filteredRequests.length === 0) return null;
    return (
      filteredRequests.find((r) => r.id === selectedId) ?? filteredRequests[0]
    );
  }, [filteredRequests, selectedId]);

  const activeRequestNumber = activeRequest
    ? requestIndexMap.get(activeRequest.id) ?? 0
    : 0;

  const totalDeckPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / DECK_PAGE_SIZE)
  );
  const safeDeckPage = Math.min(deckPage, totalDeckPages - 1);

  const visibleDeckRequests = useMemo(() => {
    if (showAllDeck) return filteredRequests;
    const start = safeDeckPage * DECK_PAGE_SIZE;
    return filteredRequests.slice(start, start + DECK_PAGE_SIZE);
  }, [filteredRequests, safeDeckPage, showAllDeck]);

  const deckRangeStart = safeDeckPage * DECK_PAGE_SIZE + 1;
  const deckRangeEnd = Math.min(
    filteredRequests.length,
    (safeDeckPage + 1) * DECK_PAGE_SIZE
  );

  const buildLocalDecisionUpdate = useCallback(
    (
      req: LabRequestDTO,
      decision: "APPROVED" | "REJECTED",
      comments?: string
    ): LabRequestDTO => {
      const nowIso = new Date().toISOString();
      const trimmed = comments?.trim() || null;
      const nextStatus: LabRequestStatus =
        decision === "APPROVED" ? "APPROVED" : "REJECTED_BY_INSTRUCTOR";

      const approval: RequestApprovalDTO = {
        id: `appr-local-${Date.now()}`,
        requestId: req.id,
        stage: "INSTRUCTOR_REVIEW",
        decision,
        approverId: user?.id ?? req.instructor.id,
        comments: trimmed,
        createdAt: nowIso,
        approver: {
          id: user?.id ?? req.instructor.id,
          fullName: user?.fullName ?? req.instructor.fullName,
          role: "INSTRUCTOR",
        },
      };

      return {
        ...req,
        status: nextStatus,
        rejectionReason: decision === "REJECTED" ? trimmed : null,
        updatedAt: nowIso,
        items:
          decision === "APPROVED"
            ? req.items.map((it) => ({
                ...it,
                approvedQuantity: it.approvedQuantity || it.requestedQuantity,
              }))
            : req.items,
        approvals: [...(req.approvals ?? []), approval],
      };
    },
    [user]
  );

  const buildLocalCollectionUpdate = useCallback(
    (req: LabRequestDTO): LabRequestDTO => {
      const nowIso = new Date().toISOString();
      const dueIso = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      return {
        ...req,
        status: "ISSUED",
        updatedAt: nowIso,
        items: req.items.map((it) => {
          const qty = it.approvedQuantity || it.requestedQuantity;
          return {
            ...it,
            approvedQuantity: qty,
            issuedQuantity: qty,
            borrowingRecords:
              it.borrowingRecords && it.borrowingRecords.length > 0
                ? it.borrowingRecords
                : [
                    {
                      id: `borrow-local-${it.id}-${Date.now()}`,
                      requestId: req.id,
                      requestItemId: it.id,
                      campusId: req.campusId,
                      itemId: it.itemId,
                      studentId: req.studentId,
                      issuedByInstructorId: user?.id ?? req.instructor.id,
                      issuedQuantity: qty,
                      returnedQuantity: 0,
                      damagedQuantity: 0,
                      missingQuantity: 0,
                      issuedAt: nowIso,
                      dueAt: dueIso,
                      closedAt: null,
                      item: {
                        id: it.item.id,
                        code: it.item.code,
                        name: it.item.name,
                        unit: it.item.unit,
                      },
                    },
                  ],
          };
        }),
      };
    },
    [user]
  );

  const handleDecision = async (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED",
    comments?: string
  ) => {
    setBusyId(req.id);
    const applyLocal = () => {
      const updated = buildLocalDecisionUpdate(req, decision, comments);
      upsertLocalStudentRequest(updated);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? updated : r)));
      toast.success(
        decision === "APPROVED"
          ? `${req.requestCode} approved — stock reserved & ready for pickup`
          : `${req.requestCode} rejected`
      );
      setRejectTarget(null);
      setRejectReason("");
    };

    try {
      if (isDemoMode) {
        applyLocal();
        return;
      }
      const res = await apiClient.requests.instructorApproval(req.id, {
        decision,
        comments: comments?.trim() || undefined,
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? res.data : r))
      );
      toast.success(
        decision === "APPROVED"
          ? `${req.requestCode} approved — stock reserved & ready for pickup`
          : `${req.requestCode} rejected`
      );
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        applyLocal();
      } else {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmCollection = async (req: LabRequestDTO) => {
    const missingItems = req.items.filter((it) => countCollectionPhotos(it) < 4);
    if (missingItems.length > 0) {
      toast.error(
        "All 4 mandatory collection angle photos (Front/Top, Back/Bottom, Left, Right) must be uploaded for every item before confirming handover."
      );
      return;
    }

    setBusyId(req.id);
    const applyLocal = () => {
      const updated = buildLocalCollectionUpdate(req);
      upsertLocalStudentRequest(updated);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? updated : r)));
      toast.success(
        `${req.requestCode} issued — stock moved from Reserved to Borrowed`
      );
    };

    try {
      if (isDemoMode) {
        applyLocal();
        return;
      }
      const res = await apiClient.requests.confirmCollection(req.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? res.data : r))
      );
      toast.success(
        `${req.requestCode} issued — stock moved from Reserved to Borrowed`
      );
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        applyLocal();
      } else {
        toast.error(err instanceof Error ? err.message : "Handover failed");
      }
    } finally {
      setBusyId(null);
    }
  };

  const isPickupStage = Boolean(
    activeRequest && HANDOVER_STATUSES.includes(activeRequest.status)
  );

  const activePhotoSummary = useMemo(() => {
    if (!activeRequest) {
      return { uploaded: 0, required: 0, allReady: false };
    }
    const required = activeRequest.items.length * REQUIRED_PHOTO_ANGLES.length;
    const uploaded = activeRequest.items.reduce(
      (sum, it) => sum + countCollectionPhotos(it),
      0
    );
    const allReady =
      activeRequest.items.length > 0 &&
      activeRequest.items.every((it) => countCollectionPhotos(it) === 4);
    return { uploaded, required, allReady };
  }, [activeRequest]);

  const activeLightboxPhoto = lightbox
    ? lightbox.photos[lightbox.index] ?? null
    : null;

  return (
    <div
      className="space-y-4"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Clean Editorial Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Student Requests
          </h1>
          <p className="mt-1 text-[13px] sm:text-[14px] leading-snug text-[#5E5E5A]">
            Review assigned borrowing requests, inspect live flowcharts, and validate 4-angle collection photos before physical handover.
          </p>
        </div>
      </div>

      {/* Dotted-Grid Spatial Canvas */}
      <DottedGridCanvas className="flex flex-col p-3.5 pb-20 sm:p-7 sm:pb-20">
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-6 sm:p-9 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] text-black/60">
              Loading assigned student requests...
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="m-auto w-full max-w-[460px] rounded-[24px] sm:rounded-[28px] border border-black/14 bg-white p-6 sm:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h2 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
              No assigned student requests yet
            </h2>
            <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              When students select you as their supervising instructor, their borrowing requests will appear here for review and handover validation.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-5 sm:gap-6">
            {/* Top Filter + Search Bar */}
            <div
              data-canvas-controls="true"
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 -mb-1 touch-pan-x sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { key: "PENDING_REVIEW", label: "Pending Review" },
                    { key: "CONFIRM_HANDOVER", label: "Confirm Handover" },
                    { key: "ALL_ASSIGNED", label: "All Assigned" },
                  ] as Array<{ key: InstructorFilter; label: string }>
                ).map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setFilter(tab.key);
                        setDeckPage(0);
                      }}
                      className={`inline-flex min-h-[40px] h-10 shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 sm:gap-2 rounded-full border px-3.5 sm:px-4 text-[13px] sm:text-[14px] font-medium transition-colors ${
                        active
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.18)]"
                          : "border-black/14 bg-white/95 text-black hover:border-black/35 hover:bg-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`tabular-nums ${
                          active ? "text-[#C4F041]" : "text-black/45"
                        }`}
                      >
                        {counts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-[300px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDeckPage(0);
                  }}
                  placeholder="Search student, ID, code, part..."
                  className="min-h-[40px] h-10 w-full rounded-full border border-black/14 bg-white/95 pl-10 pr-9 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:bg-white focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-black/45 hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-6 sm:p-8 text-center shadow-card">
                <p className="text-[16px] font-semibold text-black">
                  {search.trim()
                    ? "No matching student requests"
                    : filter === "PENDING_REVIEW"
                      ? "All caught up on first-stage reviews"
                      : filter === "CONFIRM_HANDOVER"
                        ? "No requests awaiting physical handover"
                        : "No assigned requests found"}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#5E5E5A]">
                  {search.trim()
                    ? "Try a different student name, ID, request code, or component keyword."
                    : filter === "PENDING_REVIEW"
                      ? "Check Confirm Handover for approved pickups or view all assigned requests."
                      : "Once the Campus Lab Manager reserves stock, approved pickups will appear here."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="inline-flex min-h-[40px] cursor-pointer items-center rounded-full border border-black/15 bg-[#F5F5F3] px-4 py-2 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041]"
                    >
                      Clear search
                    </button>
                  )}
                  {filter !== "CONFIRM_HANDOVER" && counts.CONFIRM_HANDOVER > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("CONFIRM_HANDOVER");
                        setDeckPage(0);
                      }}
                      className="inline-flex min-h-[40px] cursor-pointer items-center rounded-full border-2 border-black bg-[#C4F041] px-4 py-2 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041]"
                    >
                      Confirm Handover ({counts.CONFIRM_HANDOVER})
                    </button>
                  )}
                  {filter !== "ALL_ASSIGNED" && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("ALL_ASSIGNED");
                        setSearch("");
                        setDeckPage(0);
                      }}
                      className="inline-flex min-h-[40px] cursor-pointer items-center rounded-full border border-black/15 bg-white px-4 py-2 text-[14px] font-medium text-black transition-colors hover:border-black"
                    >
                      View All Assigned ({counts.ALL_ASSIGNED})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Balanced 2-Band Grid:
                 Band 1 — Paginated Student Request Deck (left) + Instructor Action & Organic Flowchart (right)
                 Band 2 — Full-Width Requested Components Gallery across all 12 columns */
              <div className="flex flex-1 flex-col gap-5 sm:gap-6">
                <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-12">
                  {/* Left Column: Tactile Paginated Student Request Deck (3 per page, zero inner scrollbar) */}
                  <div
                    data-canvas-controls="true"
                    className="min-w-0 space-y-3.5 lg:col-span-4"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={showAllDeck ? "all" : `page-${safeDeckPage}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.28, ease: LP_EASE }}
                        className="space-y-3 pr-1 pb-1"
                      >
                        {visibleDeckRequests.map((req) => {
                          const reqIdx = requestIndexMap.get(req.id) ?? 0;
                          const palette =
                            FLOW_PALETTES[reqIdx % FLOW_PALETTES.length];
                          const isSelected = activeRequest?.id === req.id;
                          const totalUnits = req.items.reduce(
                            (s, it) => s + it.requestedQuantity,
                            0
                          );
                          const statusInfo = getStatusInfo(req.status);

                          return (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => handleSelectRequest(req.id)}
                              style={
                                isSelected
                                  ? { backgroundColor: palette.banner }
                                  : undefined
                              }
                              className={`w-full cursor-pointer rounded-[18px] sm:rounded-[20px] border-2 p-3.5 sm:p-4 text-left transition-all ${
                                isSelected
                                  ? "border-black text-black shadow-[4px_4px_0px_#000000]"
                                  : "border-black/14 bg-white/95 text-black hover:border-black/40 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <p className="truncate text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black">
                                      {req.student.fullName}
                                    </p>
                                    <span className="shrink-0 font-mono text-[12px] font-medium text-black/65 tabular-nums">
                                      {req.student.institutionalId}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-[12.5px] sm:text-[13px] leading-snug text-black/65 break-words">
                                    <span className="font-mono font-medium text-black/80">
                                      {req.requestCode}
                                    </span>{" "}
                                    ·{" "}
                                    <span className="whitespace-nowrap">
                                      {formatShortDate(req.createdAt)}
                                    </span>
                                  </p>
                                </div>

                                <span
                                  title={statusInfo.label}
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                                    statusInfo.tone === "completed"
                                      ? "bg-[#C4F041] text-black"
                                      : statusInfo.tone === "handover"
                                        ? "bg-[#BCE6FA] text-black"
                                        : statusInfo.tone === "rejected"
                                          ? "bg-[#FA8E66] text-black"
                                          : "bg-white text-black"
                                  }`}
                                >
                                  {statusInfo.tone === "completed" ? (
                                    <Check className="h-4 w-4 stroke-[2.5]" />
                                  ) : statusInfo.tone === "handover" ? (
                                    <PackageCheck className="h-4 w-4 stroke-[2.2]" />
                                  ) : statusInfo.tone === "rejected" ? (
                                    <XCircle className="h-4 w-4 stroke-[2.2]" />
                                  ) : (
                                    <Clock className="h-4 w-4 stroke-[2.2]" />
                                  )}
                                </span>
                              </div>

                              {/* Real WebP Part Thumbnails */}
                              <div className="mt-3 sm:mt-3.5 flex items-center justify-between gap-2.5 sm:gap-3">
                                <div className="flex shrink-0 items-center -space-x-2">
                                  {req.items.slice(0, 4).map((it) => (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      key={it.id}
                                      src={
                                        it.item.imageUrl ||
                                        getPartImageUrl(it.item.code)
                                      }
                                      alt={it.item.name}
                                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                                    />
                                  ))}
                                  {req.items.length > 4 && (
                                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[10px] border-2 border-white bg-black text-[12px] font-semibold text-white">
                                      +{req.items.length - 4}
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 text-right">
                                  <p className="truncate text-[12.5px] sm:text-[13px] font-medium text-black tabular-nums">
                                    {req.items.length} part
                                    {req.items.length === 1 ? "" : "s"} ·{" "}
                                    {totalUnits} qty
                                  </p>
                                  <p className="truncate text-[12.5px] sm:text-[13px] text-black/65">
                                    {statusInfo.label}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    {/* Clean Deck Navigation Bar (zero inner scrollbar) */}
                    {filteredRequests.length > DECK_PAGE_SIZE && (
                      <div className="flex items-center justify-between gap-1 sm:gap-2 rounded-full border border-black/14 bg-white/95 px-1.5 sm:px-2.5 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
                        {!showAllDeck ? (
                          <>
                            <button
                              type="button"
                              disabled={safeDeckPage === 0}
                              onClick={() =>
                                setDeckPage((p) => Math.max(0, p - 1))
                              }
                              aria-label="Previous requests"
                              className="flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>

                            <div className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-2.5">
                              <span className="whitespace-nowrap text-[12px] sm:text-[13px] font-medium text-black/70 tabular-nums">
                                {deckRangeStart}–{deckRangeEnd} of{" "}
                                {filteredRequests.length}
                              </span>
                              {totalDeckPages <= 6 && (
                                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                                  {Array.from({ length: totalDeckPages }).map(
                                    (_, pIdx) => (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => setDeckPage(pIdx)}
                                        aria-label={`Page ${pIdx + 1}`}
                                        className={`h-2 shrink-0 cursor-pointer rounded-full transition-all ${
                                          pIdx === safeDeckPage
                                            ? "w-4 sm:w-5 bg-black"
                                            : "w-1.5 sm:w-2 bg-black/20 hover:bg-black/45"
                                        }`}
                                      />
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                              <button
                                type="button"
                                disabled={safeDeckPage >= totalDeckPages - 1}
                                onClick={() =>
                                  setDeckPage((p) =>
                                    Math.min(totalDeckPages - 1, p + 1)
                                  )
                                }
                                aria-label="Next requests"
                                className="flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowAllDeck(true)}
                                className="shrink-0 whitespace-nowrap cursor-pointer rounded-full px-2 sm:px-2.5 py-1.5 sm:py-1 text-[12px] sm:text-[13px] font-medium text-black/70 transition-colors hover:bg-[#C4F041] hover:text-black"
                              >
                                All
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex w-full items-center justify-between gap-2 px-1.5 sm:px-2 py-0.5">
                            <span className="truncate text-[12px] sm:text-[13px] font-medium text-black/65 tabular-nums">
                              Showing all {filteredRequests.length} requests
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAllDeck(false);
                                setDeckPage(0);
                              }}
                              className="shrink-0 whitespace-nowrap cursor-pointer rounded-full px-2.5 sm:px-3 py-1.5 sm:py-1 text-[12px] sm:text-[13px] font-medium text-black transition-colors hover:bg-[#C4F041]"
                            >
                              Compact pages
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Instructor Action Panel + Live Organic Flowchart */}
                  {activeRequest && (
                    <div
                      ref={detailRef}
                      className="min-w-0 space-y-4 scroll-mt-20 lg:col-span-8"
                    >
                      {/* Stage 1: Accept & Validate Card (when PENDING_INSTRUCTOR) */}
                      {activeRequest.status === "PENDING_INSTRUCTOR" && (
                        <div
                          data-canvas-controls="true"
                          className="rounded-[24px] border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000000] space-y-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black">
                                  <User className="h-4 w-4 shrink-0 text-black/70" />
                                  <span>{activeRequest.student.fullName}</span>
                                </span>
                                <span className="font-mono text-[13px] text-black/60 tabular-nums">
                                  {activeRequest.student.institutionalId}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[13px] text-[#5E5E5A]">
                                Stage 1 Review ·{" "}
                                <span className="font-mono text-black/75">
                                  {activeRequest.requestCode}
                                </span>{" "}
                                · Submitted{" "}
                                <span className="tabular-nums">
                                  {formatShortDate(activeRequest.createdAt)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Student Purpose Note */}
                          <div className="rounded-[16px] border border-black/12 bg-[#F7F7F5] px-4 py-3">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-black/55">
                              Student Purpose / Coursework
                            </p>
                            <p className="mt-1 text-[14px] sm:text-[15px] leading-relaxed text-black break-words">
                              {activeRequest.purpose}
                            </p>
                          </div>

                          {/* Optional Instructor Endorsement Comment */}
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`inst-comment-${activeRequest.id}`}
                              className="text-[13px] font-medium text-black/70"
                            >
                              Approval Note (optional)
                            </Label>
                            <input
                              id={`inst-comment-${activeRequest.id}`}
                              type="text"
                              value={commentsByReq[activeRequest.id] ?? ""}
                              onChange={(e) =>
                                setCommentsByReq((prev) => ({
                                  ...prev,
                                  [activeRequest.id]: e.target.value,
                                }))
                              }
                              placeholder="Add an optional note for the student..."
                              className="min-h-[44px] w-full rounded-[14px] border border-black/18 bg-white px-3.5 py-2.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                            />
                          </div>

                          {/* Primary Approve / Reject Actions */}
                          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                            <button
                              type="button"
                              disabled={busyId === activeRequest.id}
                              onClick={() =>
                                handleDecision(
                                  activeRequest,
                                  "APPROVED",
                                  commentsByReq[activeRequest.id]
                                )
                              }
                              className="inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 py-2.5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:cursor-not-allowed disabled:opacity-55"
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
                                setRejectTarget(activeRequest);
                                setRejectReason("");
                              }}
                              className="inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black/25 bg-white px-5 py-2.5 text-[14px] font-semibold text-black transition-colors hover:border-black hover:bg-[#FFF5F3] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                              <XCircle className="h-4 w-4 shrink-0 text-[#B33C17]" />
                              <span>Reject Request</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Stage 3: Handover Validation Card (when APPROVED or PARTIALLY_ISSUED) */}
                      {isPickupStage && (
                        <div
                          data-canvas-controls="true"
                          className={`rounded-[24px] border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_#000000] space-y-4 ${
                            activePhotoSummary.allReady
                              ? "bg-[#F3FBD4]"
                              : "bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                {activePhotoSummary.allReady ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-black" />
                                ) : (
                                  <Camera className="h-5 w-5 shrink-0 text-black/75" />
                                )}
                                <p className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black">
                                  {activePhotoSummary.allReady
                                    ? "All 4-angle collection photos verified"
                                    : "Waiting on student collection photos"}
                                </p>
                              </div>
                              <p className="text-[13px] sm:text-[14px] text-black/70 break-words">
                                <span className="font-medium text-black">
                                  {activeRequest.student.fullName}
                                </span>{" "}
                                ({activeRequest.student.institutionalId}) ·{" "}
                                <span className="tabular-nums">
                                  {activePhotoSummary.uploaded}/
                                  {activePhotoSummary.required} photos uploaded
                                </span>
                                {activePhotoSummary.allReady
                                  ? " · Ready for physical handover"
                                  : " · Inspect each angle before confirming"}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={busyId === activeRequest.id}
                              aria-disabled={
                                !activePhotoSummary.allReady ||
                                busyId === activeRequest.id
                              }
                              onClick={() =>
                                handleConfirmCollection(activeRequest)
                              }
                              className={`inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 text-[14px] font-semibold transition-colors ${
                                activePhotoSummary.allReady
                                  ? "cursor-pointer border-black bg-[#C4F041] text-black hover:bg-black hover:text-[#C4F041]"
                                  : "cursor-not-allowed border-black/30 bg-[#C4F041]/45 text-black/55"
                              }`}
                            >
                              <PackageCheck className="h-4 w-4 shrink-0" />
                              <span>
                                {busyId === activeRequest.id
                                  ? "Confirming..."
                                  : "Confirm Item Collection"}
                              </span>
                            </button>
                          </div>

                          {/* 4-Angle Collection Photo Inspection Grid per Item */}
                          <div className="space-y-3">
                            {activeRequest.items.map((it) => {
                              const itemPhotos = getCollectionPhotos(it);
                              const photoByAngle = new Map<
                                PhotoAngle,
                                ItemPhotoDTO
                              >(itemPhotos.map((p) => [p.angle, p]));
                              const uploadedCount = countCollectionPhotos(it);
                              const approvedQty =
                                it.approvedQuantity || it.requestedQuantity;

                              return (
                                <div
                                  key={it.id}
                                  className="rounded-[18px] border border-black/14 bg-white p-3.5 sm:p-4 space-y-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={
                                          it.item.imageUrl ||
                                          getPartImageUrl(it.item.code)
                                        }
                                        alt={it.item.name}
                                        className="h-10 w-12 shrink-0 rounded-[8px] border border-black/10 bg-[#F7F7F5] object-cover"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-black">
                                          {it.item.name}
                                        </p>
                                        <p className="font-mono text-[12px] text-black/55 tabular-nums">
                                          {it.item.code} · Qty {approvedQty}{" "}
                                          {it.item.unit}
                                        </p>
                                      </div>
                                    </div>

                                    <span
                                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold tabular-nums ${
                                        uploadedCount === 4
                                          ? "border-black bg-[#C4F041] text-black"
                                          : "border-black/20 bg-[#F7F7F5] text-black/70"
                                      }`}
                                    >
                                      <Camera className="h-3.5 w-3.5 shrink-0" />
                                      <span>{uploadedCount}/4 photos</span>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                    {REQUIRED_PHOTO_ANGLES.map((angle) => {
                                      const photo = photoByAngle.get(angle);
                                      if (photo) {
                                        const orderedPhotos =
                                          REQUIRED_PHOTO_ANGLES.map((a) =>
                                            photoByAngle.get(a)
                                          ).filter(
                                            (p): p is ItemPhotoDTO => Boolean(p)
                                          );
                                        const photoIdx =
                                          orderedPhotos.findIndex(
                                            (p) => p.id === photo.id
                                          );

                                        return (
                                          <button
                                            key={angle}
                                            type="button"
                                            onClick={() =>
                                              setLightbox({
                                                itemName: it.item.name,
                                                itemCode: it.item.code,
                                                studentName:
                                                  activeRequest.student
                                                    .fullName,
                                                photos: orderedPhotos,
                                                index: Math.max(0, photoIdx),
                                              })
                                            }
                                            className="group relative flex flex-col overflow-hidden rounded-[14px] border-2 border-black/15 bg-[#F7F7F5] text-left transition-all hover:border-black cursor-pointer"
                                          >
                                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={photo.url}
                                                alt={`${it.item.name} — ${ANGLE_LABELS[angle]}`}
                                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                              />
                                              <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-black/15 bg-white/90 text-black shadow-xs transition-colors group-hover:border-black group-hover:bg-[#C4F041]">
                                                <ZoomIn className="h-3.5 w-3.5" />
                                              </span>
                                            </div>
                                            <span className="px-2 py-1.5 text-center text-[12px] font-medium text-black truncate">
                                              {ANGLE_LABELS[angle]}
                                            </span>
                                          </button>
                                        );
                                      }

                                      return (
                                        <div
                                          key={angle}
                                          className="flex flex-col overflow-hidden rounded-[14px] border-2 border-dashed border-black/20 bg-[#F7F7F5]"
                                        >
                                          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 px-2 text-center text-black/45">
                                            <Camera className="h-4 w-4" />
                                            <span className="text-[12px] font-medium">
                                              Missing
                                            </span>
                                          </div>
                                          <span className="px-2 py-1.5 text-center text-[12px] font-medium text-black/55 truncate">
                                            {ANGLE_LABELS[angle]}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recorded Rejection Reason Banner */}
                      {activeRequest.rejectionReason && (
                        <div className="flex items-start gap-3 rounded-[20px] sm:rounded-[22px] border-2 border-black bg-[#FFF5F3] px-4 py-3.5 sm:px-5 sm:py-4 text-[13px] sm:text-[14px] text-black shadow-[3px_3px_0px_#000000]">
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#B33C17]" />
                          <div className="min-w-0">
                            <p className="font-semibold">Rejection Reason</p>
                            <p className="mt-0.5 text-black/75 break-words">
                              {activeRequest.rejectionReason}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Live Organic Flowchart */}
                      <AnimatePresence mode="wait">
                        <RequestFlowchartCard
                          key={activeRequest.id}
                          request={activeRequest}
                          index={activeRequestNumber}
                        />
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Band 2: Full-Width Requested Components Gallery */}
                {activeRequest && (
                  <div
                    data-canvas-controls="true"
                    className="w-full rounded-[20px] sm:rounded-[24px] border border-black/14 bg-white/95 p-4 sm:p-6 shadow-card"
                  >
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 pb-3.5 sm:pb-4 border-b border-black/10">
                      <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 shrink-0 text-black/70" />
                          <h2 className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black">
                            Requested Components ({activeRequest.items.length})
                          </h2>
                        </div>
                        <span className="text-[13px] sm:text-[14px] text-[#5E5E5A] break-words">
                          · {activeRequest.student.fullName} (
                          {activeRequest.student.institutionalId})
                        </span>
                        {activeRequest.purpose.trim() && (
                          <span className="text-[13px] sm:text-[14px] text-[#5E5E5A] break-words">
                            · {activeRequest.purpose}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[12px] sm:text-[13px] text-black/55 tabular-nums">
                        {activeRequest.requestCode}
                      </span>
                    </div>

                    <div className="mt-3.5 sm:mt-4 grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {activeRequest.items.map((it) => {
                        const photoCount = countCollectionPhotos(it);
                        return (
                          <div
                            key={it.id}
                            className="flex items-start gap-3 rounded-[16px] border border-black/12 bg-[#F7F7F5] p-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                it.item.imageUrl ||
                                getPartImageUrl(it.item.code)
                              }
                              alt={it.item.name}
                              className="h-12 w-14 shrink-0 rounded-[10px] border border-black/10 bg-white object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 sm:line-clamp-none sm:truncate text-[14px] font-semibold leading-snug text-black">
                                {it.item.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[12px] text-black/55 truncate">
                                {it.item.code}
                              </p>
                              <p className="mt-1 text-[13px] text-[#5E5E5A] tabular-nums">
                                Req: {it.requestedQuantity} {it.item.unit}
                                {it.approvedQuantity > 0
                                  ? ` · Appr: ${it.approvedQuantity}`
                                  : ""}
                                {it.issuedQuantity > 0
                                  ? ` · Issued: ${it.issuedQuantity}`
                                  : ""}
                              </p>
                              {isPickupStage && (
                                <p
                                  className={`mt-1 text-[12px] font-semibold tabular-nums ${
                                    photoCount === 4
                                      ? "text-black"
                                      : "text-[#B33C17]"
                                  }`}
                                >
                                  {photoCount}/4 photos
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DottedGridCanvas>

      {/* Reject Request Dialog */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent className="rounded-[24px] border-2 border-black bg-white text-black shadow-[6px_6px_0px_#000000]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-black">
              Reject {rejectTarget?.requestCode}
            </DialogTitle>
            <DialogDescription className="text-[14px] text-[#5E5E5A]">
              Share a brief reason so {rejectTarget?.student.fullName} can revise and resubmit the request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label
              htmlFor="inst-reject-reason"
              className="text-[13px] font-medium text-black/75"
            >
              Rejection Reason (required, min 3 characters)
            </Label>
            <Textarea
              id="inst-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Please reduce requested quantity to 1 unit per lab team."
              className="min-h-[104px] rounded-[16px] border-black/20 bg-white text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus-visible:border-black focus-visible:ring-[#C4F041]/50"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center rounded-full border-2 border-black/20 bg-white px-5 py-2 text-[14px] font-semibold text-black transition-colors hover:border-black"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(busyId) || rejectReason.trim().length < 3}
              onClick={() =>
                rejectTarget &&
                handleDecision(rejectTarget, "REJECTED", rejectReason)
              }
              className="inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#FA8E66] px-5 py-2 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#FA8E66] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{busyId ? "Rejecting..." : "Confirm Rejection"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Photo Lightbox Dialog */}
      <Dialog
        open={Boolean(lightbox && activeLightboxPhoto)}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent className="max-w-2xl rounded-[24px] border-2 border-black bg-white text-black shadow-[6px_6px_0px_#000000]">
          {lightbox && activeLightboxPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px] font-semibold text-black pr-6">
                  {lightbox.itemName} ·{" "}
                  {ANGLE_LABELS[activeLightboxPhoto.angle]}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#5E5E5A]">
                  <span className="font-mono">{lightbox.itemCode}</span> ·
                  Uploaded by {lightbox.studentName} ·{" "}
                  <span className="tabular-nums">
                    {formatShortDate(activeLightboxPhoto.createdAt)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-[16px] border border-black/14 bg-[#F7F7F5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightboxPhoto.url}
                  alt={`${lightbox.itemName} — ${ANGLE_LABELS[activeLightboxPhoto.angle]}`}
                  className="max-h-[65vh] w-full object-contain"
                />
              </div>

              {lightbox.photos.length > 1 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                (prev.index - 1 + prev.photos.length) %
                                prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-black/20 bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  <span className="text-[13px] font-medium text-black/65 tabular-nums">
                    {lightbox.index + 1} of {lightbox.photos.length}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-black/20 bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
