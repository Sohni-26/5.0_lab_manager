"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import {
  FLOW_PALETTES,
  RequestFlowchartCard,
} from "@/components/dashboard/request-flowchart";
import { LoopsiiButton } from "@/components/landing/primitives";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import { readLocalStudentRequests } from "@/lib/student-requests-store";
import type { LabRequestDTO, LabRequestStatus } from "@/types/contracts";

type RequestFilter = "ALL" | "PENDING" | "ACTIVE" | "COMPLETED";

const DECK_PAGE_SIZE = 3;
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

const COMPLETED_STATUSES: LabRequestStatus[] = [
  "CLOSED",
  "REJECTED_BY_INSTRUCTOR",
  "REJECTED_BY_LAB_MANAGER",
];

function getStatusInfo(status: LabRequestStatus): {
  label: string;
  tone: "pending" | "completed" | "rejected";
} {
  switch (status) {
    case "PENDING_INSTRUCTOR":
      return { label: "Instructor review", tone: "pending" };
    case "PENDING_LAB_MANAGER":
      return { label: "Lab manager review", tone: "pending" };
    case "APPROVED":
      return { label: "Ready for pickup", tone: "pending" };
    case "PARTIALLY_ISSUED":
    case "ISSUED":
      return { label: "Issued", tone: "completed" };
    case "RETURN_PENDING":
    case "RETURN_SUBMITTED":
    case "RETURN_VERIFICATION_PENDING":
    case "RETURN_DISPUTED":
    case "PARTIALLY_RETURNED":
      return { label: "Return in progress", tone: "pending" };
    case "CLOSED":
      return { label: "Closed", tone: "completed" };
    case "REJECTED_BY_INSTRUCTOR":
    case "REJECTED_BY_LAB_MANAGER":
      return { label: "Rejected", tone: "rejected" };
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

export default function StudentMyRequestsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RequestFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deckPage, setDeckPage] = useState(0);
  const [showAllDeck, setShowAllDeck] = useState(false);
  const flowchartRef = useRef<HTMLDivElement | null>(null);

  const handleSelectRequest = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        flowchartRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const load = useCallback(async () => {
    if (isDemoMode) {
      const local = readLocalStudentRequests();
      const merged = [
        ...local,
        ...DEMO_REQUESTS.filter((d) => !local.some((l) => l.id === d.id)),
      ];
      setRequests(merged);
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      setRequests(res.data);
    } catch {
      const local = readLocalStudentRequests();
      setRequests([
        ...local,
        ...DEMO_REQUESTS.filter((d) => !local.some((l) => l.id === d.id)),
      ]);
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
    onEvent: (evt) => {
      void load();
      if (evt.summary && evt.entityId !== "local-sync") {
        toast.info(evt.summary);
      }
    },
    onReconnect: () => {
      void load();
    },
  });

  // Preserve chronological request numbering identical to the Student Dashboard
  const requestIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((req, idx) => {
      map.set(req.id, requests.length - 1 - idx);
    });
    return map;
  }, [requests]);

  const counts = useMemo(
    () => ({
      ALL: requests.length,
      PENDING: requests.filter((r) => PENDING_STATUSES.includes(r.status)).length,
      ACTIVE: requests.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
      COMPLETED: requests.filter((r) => COMPLETED_STATUSES.includes(r.status))
        .length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (filter === "PENDING" && !PENDING_STATUSES.includes(req.status)) {
        return false;
      }
      if (filter === "ACTIVE" && !ACTIVE_STATUSES.includes(req.status)) {
        return false;
      }
      if (filter === "COMPLETED" && !COMPLETED_STATUSES.includes(req.status)) {
        return false;
      }
      if (!q) return true;
      const reqNum = `request ${(requestIndexMap.get(req.id) ?? 0) + 1}`;
      return (
        reqNum.includes(q) ||
        req.requestCode.toLowerCase().includes(q) ||
        req.instructor.fullName.toLowerCase().includes(q) ||
        req.purpose.toLowerCase().includes(q) ||
        req.items.some((it) => it.item.name.toLowerCase().includes(q))
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
            My Requests
          </h1>
          <p className="mt-1 text-[13px] sm:text-[14px] leading-snug text-[#5E5E5A]">
            Inspect each borrowing request as a live visual flowchart and review all requested parts.
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

      {/* Dotted-Grid Spatial Canvas (matching Student Dashboard) */}
      <DottedGridCanvas className="flex flex-col p-3.5 pb-20 sm:p-7 sm:pb-16">
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-6 sm:p-9 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] text-black/60">Loading your requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="m-auto w-full max-w-[460px] rounded-[24px] sm:rounded-[28px] border border-black/14 bg-white p-6 sm:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h2 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
              No borrowing requests yet
            </h2>
            <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              Pick parts from your campus lab catalog and every request will appear here as an interactive flowchart.
            </p>
            <div className="mt-6 sm:mt-7 flex justify-center">
              <LoopsiiButton
                label="Browse Inventory"
                href="/student/inventory"
                size="md"
                hideArrow
              />
            </div>
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
                    { key: "ALL", label: "All" },
                    { key: "PENDING", label: "Pending" },
                    { key: "ACTIVE", label: "Active" },
                    { key: "COMPLETED", label: "Closed" },
                  ] as Array<{ key: RequestFilter; label: string }>
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

              <div className="relative w-full sm:w-[290px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDeckPage(0);
                  }}
                  placeholder="Search request or part..."
                  className="min-h-[40px] h-10 w-full rounded-full border border-black/14 bg-white/95 pl-10 pr-9 text-[14px] text-black placeholder:text-black/40 focus:border-black focus:bg-white focus:outline-none"
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
              <div className="m-auto w-full max-w-[420px] rounded-[24px] border border-black/14 bg-white p-6 sm:p-8 text-center shadow-card">
                <p className="text-[16px] font-medium text-black">
                  No matching requests
                </p>
                <p className="mt-1.5 text-[14px] text-[#5E5E5A]">
                  Try another filter or clear your search query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("ALL");
                    setSearch("");
                  }}
                  className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center rounded-full border border-black/15 bg-[#F5F5F3] px-4 py-2 text-[14px] font-medium text-black hover:bg-[#C4F041]"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              /* Balanced 2-Band Grid:
                 Band 1 — Request Deck (left) aligned height-for-height with Organic Flowchart (right)
                 Band 2 — Full-width Requested Components gallery aligned cleanly across all 12 columns */
              <div className="flex flex-1 flex-col gap-5 sm:gap-6">
                <div className="grid items-center gap-5 sm:gap-6 lg:grid-cols-12">
                  {/* Left Column: Tactile Paginated Request Deck (3 per page — height matched to Flowchart) */}
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
                                  <p className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black">
                                    Request {reqIdx + 1}
                                  </p>
                                  <p className="mt-0.5 text-[12.5px] sm:text-[13px] leading-snug text-black/65 break-words">
                                    {req.instructor.fullName} ·{" "}
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
                                      : statusInfo.tone === "rejected"
                                        ? "bg-[#FA8E66] text-black"
                                        : "bg-white text-black"
                                  }`}
                                >
                                  {statusInfo.tone === "completed" ? (
                                    <Check className="h-4 w-4 stroke-[2.5]" />
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
                                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[10px] border-2 border-white bg-black text-[11px] sm:text-[12px] font-semibold text-white">
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

                    {/* Clean Deck Navigation Bar (replaces native inner scrollbar) */}
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

                  {/* Right Column: Live Visual Flowchart */}
                  {activeRequest && (
                    <div
                      ref={flowchartRef}
                      className="min-w-0 space-y-4 scroll-mt-20 lg:col-span-8"
                    >
                      {/* Contextual Next-Step Action Banner when Ready for Pickup / Return */}
                      {activeRequest.status === "APPROVED" && (
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 rounded-[20px] sm:rounded-[22px] border-2 border-black bg-[#F3FBD4] px-4 py-3.5 sm:px-5 sm:py-4 shadow-[3px_3px_0px_#000000]">
                          <div className="min-w-0">
                            <p className="text-[15px] sm:text-[16px] font-semibold text-black">
                              Approved and ready for pickup
                            </p>
                            <p className="mt-0.5 text-[13px] sm:text-[14px] text-black/70">
                              Upload 4-angle collection photos at the lab counter to receive your parts.
                            </p>
                          </div>
                          <div className="shrink-0">
                            <LoopsiiButton
                              label="Upload Collection Photos"
                              href="/student/borrowed"
                              size="sm"
                              hideArrow
                            />
                          </div>
                        </div>
                      )}

                      {(activeRequest.status === "ISSUED" ||
                        activeRequest.status === "RETURN_PENDING") && (
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 rounded-[20px] sm:rounded-[22px] border-2 border-black bg-white px-4 py-3.5 sm:px-5 sm:py-4 shadow-[3px_3px_0px_#000000]">
                          <div className="min-w-0">
                            <p className="text-[15px] sm:text-[16px] font-semibold text-black">
                              Components currently issued
                            </p>
                            <p className="mt-0.5 text-[13px] sm:text-[14px] text-black/70">
                              Done with your build? Submit return photos to close this request.
                            </p>
                          </div>
                          <div className="shrink-0">
                            <LoopsiiButton
                              label="Submit Return"
                              href="/student/returns"
                              size="sm"
                              hideArrow
                            />
                          </div>
                        </div>
                      )}

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

                      {/* Organic Excalidraw Flowchart (compact by default — click to reveal upcoming steps) */}
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

                {/* Band 2: Full-Width Requested Components Gallery (aligned edge-to-edge across the grid) */}
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
                      {activeRequest.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-3 rounded-[16px] border border-black/12 bg-[#F7F7F5] p-3"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              it.item.imageUrl || getPartImageUrl(it.item.code)
                            }
                            alt={it.item.name}
                            className="h-12 w-14 shrink-0 rounded-[10px] border border-black/10 bg-white object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 sm:line-clamp-none sm:truncate text-[14px] font-semibold leading-snug text-black">
                              {it.item.name}
                            </p>
                            <p className="mt-0.5 text-[13px] text-[#5E5E5A] tabular-nums">
                              Qty: {it.requestedQuantity} {it.item.unit}
                              {it.issuedQuantity > 0
                                ? ` · Issued: ${it.issuedQuantity}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DottedGridCanvas>
    </div>
  );
}
