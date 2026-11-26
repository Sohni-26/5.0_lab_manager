"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

const DECK_PAGE_SIZE = 4;
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
    eventTypes: ["request.status_changed", "borrowing.issued", "return.verified"],
    onEvent: () => load(),
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            My Requests
          </h1>
          <p className="mt-1 text-[14px] text-[#5E5E5A]">
            Inspect each borrowing request as a live visual flowchart and review all requested parts.
          </p>
        </div>

        <LoopsiiButton
          label="Browse Inventory"
          href="/student/inventory"
          size="md"
          hideArrow
        />
      </div>

      {/* Dotted-Grid Spatial Canvas (matching Student Dashboard) */}
      <DottedGridCanvas className="flex flex-col p-5 sm:p-7">
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-9 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] text-black/60">Loading your requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="m-auto w-full max-w-[460px] rounded-[28px] border border-black/14 bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h2 className="text-[26px] font-medium tracking-[-0.03em] text-black">
              No borrowing requests yet
            </h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#5E5E5A]">
              Pick parts from your campus lab catalog and every request will appear here as an interactive flowchart.
            </p>
            <div className="mt-7 flex justify-center">
              <LoopsiiButton
                label="Browse Inventory"
                href="/student/inventory"
                size="md"
                hideArrow
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            {/* Top Filter + Search Bar */}
            <div
              data-canvas-controls="true"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
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
                      className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors ${
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
                  className="h-10 w-full rounded-full border border-black/14 bg-white/95 pl-10 pr-9 text-[14px] text-black placeholder:text-black/40 focus:border-black focus:bg-white focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-black/45 hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="m-auto w-full max-w-[420px] rounded-[24px] border border-black/14 bg-white p-8 text-center shadow-card">
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
                  className="mt-4 inline-flex cursor-pointer items-center rounded-full border border-black/15 bg-[#F5F5F3] px-4 py-2 text-[14px] font-medium text-black hover:bg-[#C4F041]"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              /* Master-Detail Visual Flowchart Board */
              <div className="grid flex-1 items-start gap-6 lg:grid-cols-12">
                {/* Left Column: Tactile Paginated Request Deck (Zero Inner Scrollbar) */}
                <div
                  data-canvas-controls="true"
                  className="space-y-3.5 lg:col-span-4"
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
                            onClick={() => setSelectedId(req.id)}
                            style={
                              isSelected
                                ? { backgroundColor: palette.banner }
                                : undefined
                            }
                            className={`w-full cursor-pointer rounded-[20px] border-2 p-4 text-left transition-all ${
                              isSelected
                                ? "border-black text-black shadow-[4px_4px_0px_#000000]"
                                : "border-black/14 bg-white/95 text-black hover:border-black/40 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[16px] font-semibold tracking-[-0.02em] text-black">
                                  Request {reqIdx + 1}
                                </p>
                                <p className="mt-0.5 text-[13px] text-black/65">
                                  {req.instructor.fullName} ·{" "}
                                  {formatShortDate(req.createdAt)}
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
                            <div className="mt-3.5 flex items-center justify-between gap-3">
                              <div className="flex items-center -space-x-2">
                                {req.items.slice(0, 4).map((it) => (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    key={it.id}
                                    src={
                                      it.item.imageUrl ||
                                      getPartImageUrl(it.item.code)
                                    }
                                    alt={it.item.name}
                                    className="h-9 w-9 rounded-[10px] border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                                  />
                                ))}
                                {req.items.length > 4 && (
                                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-white bg-black text-[12px] font-semibold text-white">
                                    +{req.items.length - 4}
                                  </span>
                                )}
                              </div>

                              <div className="text-right">
                                <p className="text-[13px] font-medium text-black tabular-nums">
                                  {req.items.length} part
                                  {req.items.length === 1 ? "" : "s"} ·{" "}
                                  {totalUnits} qty
                                </p>
                                <p className="text-[13px] text-black/65">
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
                    <div className="flex items-center justify-between gap-2 rounded-full border border-black/14 bg-white/95 px-2.5 py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
                      {!showAllDeck ? (
                        <>
                          <button
                            type="button"
                            disabled={safeDeckPage === 0}
                            onClick={() =>
                              setDeckPage((p) => Math.max(0, p - 1))
                            }
                            aria-label="Previous requests"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>

                          <div className="flex items-center gap-2.5">
                            <span className="text-[13px] font-medium text-black/70 tabular-nums">
                              {deckRangeStart}–{deckRangeEnd} of{" "}
                              {filteredRequests.length}
                            </span>
                            {totalDeckPages <= 6 && (
                              <div className="flex items-center gap-1.5">
                                {Array.from({ length: totalDeckPages }).map(
                                  (_, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() => setDeckPage(pIdx)}
                                      aria-label={`Page ${pIdx + 1}`}
                                      className={`h-2 cursor-pointer rounded-full transition-all ${
                                        pIdx === safeDeckPage
                                          ? "w-5 bg-black"
                                          : "w-2 bg-black/20 hover:bg-black/45"
                                      }`}
                                    />
                                  )
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={safeDeckPage >= totalDeckPages - 1}
                              onClick={() =>
                                setDeckPage((p) =>
                                  Math.min(totalDeckPages - 1, p + 1)
                                )
                              }
                              aria-label="Next requests"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAllDeck(true)}
                              className="cursor-pointer rounded-full px-2.5 py-1 text-[13px] font-medium text-black/70 transition-colors hover:bg-[#C4F041] hover:text-black"
                            >
                              All
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex w-full items-center justify-between px-2 py-0.5">
                          <span className="text-[13px] font-medium text-black/65 tabular-nums">
                            Showing all {filteredRequests.length} requests
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAllDeck(false);
                              setDeckPage(0);
                            }}
                            className="cursor-pointer rounded-full px-3 py-1 text-[13px] font-medium text-black transition-colors hover:bg-[#C4F041]"
                          >
                            Compact pages
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Live Visual Flowchart + Full Parts Gallery */}
                {activeRequest && (
                  <div className="space-y-6 lg:col-span-8">
                    {/* Contextual Next-Step Action Banner when Ready for Pickup / Return */}
                    {activeRequest.status === "APPROVED" && (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-2 border-black bg-[#F3FBD4] px-5 py-4 shadow-[3px_3px_0px_#000000]">
                        <div>
                          <p className="text-[16px] font-semibold text-black">
                            Approved and ready for pickup
                          </p>
                          <p className="text-[14px] text-black/70">
                            Upload 4-angle collection photos at the lab counter to receive your parts.
                          </p>
                        </div>
                        <LoopsiiButton
                          label="Upload Collection Photos"
                          href="/student/borrowed"
                          size="sm"
                          hideArrow
                        />
                      </div>
                    )}

                    {(activeRequest.status === "ISSUED" ||
                      activeRequest.status === "RETURN_PENDING") && (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-2 border-black bg-white px-5 py-4 shadow-[3px_3px_0px_#000000]">
                        <div>
                          <p className="text-[16px] font-semibold text-black">
                            Components currently issued
                          </p>
                          <p className="text-[14px] text-black/70">
                            Done with your build? Submit return photos to close this request.
                          </p>
                        </div>
                        <LoopsiiButton
                          label="Submit Return"
                          href="/student/returns"
                          size="sm"
                          hideArrow
                        />
                      </div>
                    )}

                    {activeRequest.rejectionReason && (
                      <div className="flex items-start gap-3 rounded-[22px] border-2 border-black bg-[#FFF5F3] px-5 py-4 text-[14px] text-black shadow-[3px_3px_0px_#000000]">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#B33C17]" />
                        <div>
                          <p className="font-semibold">Rejection Reason</p>
                          <p className="mt-0.5 text-black/75">
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

                    {/* Full Requested Components Gallery (with real WebP photos) */}
                    <div
                      data-canvas-controls="true"
                      className="rounded-[24px] border border-black/14 bg-white/95 p-6 shadow-card"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-black/10">
                        <div className="flex items-center gap-2.5">
                          <Package className="h-4 w-4 text-black/70" />
                          <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-black">
                            Requested Components ({activeRequest.items.length})
                          </h2>
                        </div>
                        <span className="font-mono text-[13px] text-black/55 tabular-nums">
                          {activeRequest.requestCode}
                        </span>
                      </div>

                      {activeRequest.purpose.trim() && (
                        <p className="mt-4 rounded-[14px] border border-black/10 bg-[#F7F7F5] px-4 py-3 text-[14px] leading-relaxed text-black/80">
                          {activeRequest.purpose}
                        </p>
                      )}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {activeRequest.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center gap-3.5 rounded-[16px] border border-black/12 bg-[#F7F7F5] p-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                it.item.imageUrl ||
                                getPartImageUrl(it.item.code)
                              }
                              alt={it.item.name}
                              className="h-14 w-16 shrink-0 rounded-[12px] border border-black/10 bg-white object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-black">
                                {it.item.name}
                              </p>
                              <p className="mt-0.5 text-[13px] text-[#5E5E5A] tabular-nums">
                                Requested: {it.requestedQuantity}{" "}
                                {it.item.unit}
                                {it.issuedQuantity > 0
                                  ? ` · Issued: ${it.issuedQuantity}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
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
