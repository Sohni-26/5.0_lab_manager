"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
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
import { PartPickerCard } from "@/components/student/part-picker-card";
import { StudentRequestDock } from "@/components/student/request-dock";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_CAMPUS_INVENTORY,
  DEMO_CATEGORIES,
  DEMO_USERS,
} from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import {
  buildLocalLabRequestDTO,
  readLocalStudentRequests,
  saveLocalStudentRequests,
} from "@/lib/student-requests-store";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  ItemCategoryDTO,
  LabRequestDTO,
} from "@/types/contracts";

type FlowStage = "board" | "parts";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const BATCH_SIZE = 24;

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
      key={`drag-item-${resetSignal}`}
      data-canvas-draggable="true"
      drag
      dragConstraints={canvasRef}
      dragElastic={0.08}
      dragMomentum={false}
      onDragStart={markMoved}
      whileDrag={{ scale: 1.01, zIndex: 25 }}
      className={`cursor-grab active:cursor-grabbing ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

export function StudentRequestFlow() {
  const { user, isDemoMode } = useAuth();
  const { lenis, scrollTo } = useLenis();
  const [stage, setStage] = useState<FlowStage>("board");
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [instructors, setInstructors] = useState<AuthUserDTO[]>([]);
  const [savedRequests, setSavedRequests] = useState<LabRequestDTO[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showMoreRequests, setShowMoreRequests] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters & progressive batching for silky 60fps rendering
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);

  // Selected parts map: itemId -> quantity
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [instructorId, setInstructorId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      const demoInv = DEMO_CAMPUS_INVENTORY.filter(
        (i) => i.isVerified && i.isVisible
      );
      const demoInsts = DEMO_USERS.filter((u) => u.role === "INSTRUCTOR");
      setInventory(demoInv);
      setCategories(DEMO_CATEGORIES);
      setInstructors(demoInsts);
      if (demoInsts.length > 0) setInstructorId(demoInsts[0].id);

      setSavedRequests(readLocalStudentRequests());
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.inventory
        .list({ pageSize: 250 })
        .then((r) => r.data.filter((i) => i.isVerified && i.isVisible))
        .catch(() =>
          DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
        ),
      apiClient.categories
        .list()
        .then((r) => r.data)
        .catch(() => DEMO_CATEGORIES),
      apiClient.users
        .list({ role: "INSTRUCTOR", pageSize: 50 })
        .then((r) => r.data)
        .catch(() => DEMO_USERS.filter((u) => u.role === "INSTRUCTOR")),
      apiClient.requests
        .list({ pageSize: 20 })
        .then((r) => r.data)
        .catch(() => []),
    ])
      .then(([inv, cats, insts, reqs]) => {
        setInventory(inv);
        setCategories(cats);
        setInstructors(insts);
        setSavedRequests(reqs);
        if (insts.length > 0) setInstructorId(insts[0].id);
      })
      .finally(() => setLoading(false));
  }, [isDemoMode]);

  // Persist demo requests on the student's dashboard across reloads
  const persistDemoRequests = useCallback(
    (next: LabRequestDTO[]) => {
      if (!isDemoMode) return;
      saveLocalStudentRequests(next);
    },
    [isDemoMode]
  );

  // Smoothly reset scroll on stage transitions and sync Lenis
  useEffect(() => {
    scrollTo(0);
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [stage, savedRequests.length, lenis, scrollTo]);

  const filteredParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((row) => {
      const meta = extractItemProcurementMeta(row.item.specifications);
      if (categoryFilter !== "ALL" && row.item.category.id !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.item.name.toLowerCase().includes(q) ||
        row.item.code.toLowerCase().includes(q) ||
        row.item.category.name.toLowerCase().includes(q) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [inventory, search, categoryFilter, labBlockFilter]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, categoryFilter, labBlockFilter, stage]);

  useEffect(() => {
    if (
      stage !== "parts" ||
      !sentinelEl ||
      visibleCount >= filteredParts.length
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) =>
            prev < filteredParts.length
              ? Math.min(filteredParts.length, prev + BATCH_SIZE)
              : prev
          );
        }
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [stage, sentinelEl, visibleCount, filteredParts.length]);

  useEffect(() => {
    if (stage !== "parts") return;
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [visibleCount, filteredParts.length, stage, lenis]);

  const visibleParts = useMemo(
    () => filteredParts.slice(0, visibleCount),
    [filteredParts, visibleCount]
  );

  const inventoryByItemId = useMemo(
    () => new Map(inventory.map((row) => [row.itemId, row])),
    [inventory]
  );

  const selectedEntries = useMemo(() => {
    return Object.entries(selectedQty)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        qty,
        row: inventoryByItemId.get(itemId),
      }))
      .filter(
        (
          entry
        ): entry is { itemId: string; qty: number; row: CampusInventoryDTO } =>
          Boolean(entry.row)
      );
  }, [selectedQty, inventoryByItemId]);

  const totalSelectedUnits = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.qty, 0),
    [selectedEntries]
  );

  const togglePart = useCallback((row: CampusInventoryDTO) => {
    if (row.availableQuantity <= 0) return;
    setSelectedQty((prev) => {
      const current = prev[row.itemId] ?? 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[row.itemId];
        return next;
      }
      return { ...prev, [row.itemId]: 1 };
    });
  }, []);

  const updatePartQty = useCallback(
    (row: CampusInventoryDTO, nextVal: number) => {
      if (row.availableQuantity <= 0) return;
      setSelectedQty((prev) => {
        if (nextVal <= 0) {
          const next = { ...prev };
          delete next[row.itemId];
          return next;
        }
        const clamped = Math.min(row.availableQuantity, Math.max(1, nextVal));
        return { ...prev, [row.itemId]: clamped };
      });
    },
    []
  );

  const handleSubmitRequest = async () => {
    if (selectedEntries.length === 0) {
      toast.error("Select at least one part to raise a request");
      return;
    }
    if (!instructorId) {
      toast.error("Choose a supervising Instructor");
      return;
    }

    const cleanPurpose = purpose.trim();

    const chosenInstructor =
      instructors.find((i) => i.id === instructorId) ?? instructors[0];

    const buildLocalRequestDTO = (): LabRequestDTO =>
      buildLocalLabRequestDTO({
        user,
        instructor: chosenInstructor,
        instructorId,
        purpose: cleanPurpose,
        entries: selectedEntries,
      });

    setSubmitting(true);
    try {
      let createdReq: LabRequestDTO;
      if (isDemoMode) {
        createdReq = buildLocalRequestDTO();
      } else {
        const res = await apiClient.requests.create({
          instructorId,
          purpose:
            cleanPurpose.length >= 5
              ? cleanPurpose
              : "Campus laboratory equipment borrowing request",
          items: selectedEntries.map((e) => ({
            itemId: e.itemId,
            requestedQuantity: e.qty,
          })),
        });
        createdReq = res.data;
      }

      setSavedRequests((prev) => {
        const next = [createdReq, ...prev];
        persistDemoRequests(next);
        return next;
      });
      setSelectedRequestId(createdReq.id);
      setShowMoreRequests(false);

      toast.success("Request added to your dashboard flowchart");
      setSelectedQty({});
      setPurpose("");
      setStage("board");
    } catch {
      const createdReq = buildLocalRequestDTO();
      setSavedRequests((prev) => {
        const next = [createdReq, ...prev];
        persistDemoRequests(next);
        return next;
      });
      setSelectedRequestId(createdReq.id);
      setShowMoreRequests(false);
      toast.success("Request added to your dashboard flowchart");
      setSelectedQty({});
      setPurpose("");
      setStage("board");
    } finally {
      setSubmitting(false);
    }
  };

  const hasRequests = savedRequests.length > 0;

  // Keep active focused request synced (defaults to newest request)
  const activeRequest = useMemo(() => {
    if (savedRequests.length === 0) return null;
    return (
      savedRequests.find((r) => r.id === selectedRequestId) ?? savedRequests[0]
    );
  }, [savedRequests, selectedRequestId]);

  const activeRequestNumber = useMemo(() => {
    if (!activeRequest) return 0;
    const idx = savedRequests.findIndex((r) => r.id === activeRequest.id);
    return idx === -1 ? 0 : savedRequests.length - 1 - idx;
  }, [savedRequests, activeRequest]);

  // Top 3 clustered requests visible immediately; remaining accessible via clean "Show more" list
  const topClusterRequests = useMemo(
    () => savedRequests.slice(0, 3),
    [savedRequests]
  );
  const overflowRequests = useMemo(
    () => savedRequests.slice(3),
    [savedRequests]
  );

  return (
    <div
      className="w-full min-w-0"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Always-visible floating bottom request dock whenever parts are selected */}
      {stage === "parts" && (
        <StudentRequestDock
          selectedEntries={selectedEntries}
          totalSelectedUnits={totalSelectedUnits}
          instructors={instructors}
          instructorId={instructorId}
          onInstructorChange={setInstructorId}
          purpose={purpose}
          onPurposeChange={setPurpose}
          onUpdateQty={updatePartQty}
          onClearAll={() => setSelectedQty({})}
          onSubmit={handleSubmitRequest}
          submitting={submitting}
          submitLabel="Submit Request"
        />
      )}

      <DottedGridCanvas
        pannable={stage === "board"}
        className="flex flex-col"
      >
        <AnimatePresence mode="wait">
          {/* MAIN STUDENT BOARD: EXACT 50/50 INVISIBLE SPLIT — FREEHAND DRAGGABLE PROMPT & FLOWCHART */}
          {stage === "board" && (
            <motion.div
              key="stage-board"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: LP_EASE }}
              className={`flex-1 min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100vh-8.5rem)] ${
                hasRequests
                  ? "grid grid-cols-1 lg:grid-cols-2"
                  : "flex items-center justify-center p-4 pb-20 sm:p-8"
              }`}
            >
              {/* Left 50%: Freehand Draggable Centered Prompt Card */}
              <div
                className={
                  hasRequests
                    ? "flex items-center justify-center p-4 pt-5 sm:p-10 lg:sticky lg:top-0 lg:h-[calc(100vh-8.5rem)]"
                    : "w-full max-w-xl"
                }
              >
                <CanvasDraggableItem className="w-full max-w-md">
                  <div className="w-full rounded-[20px] sm:rounded-[24px] border border-black/14 bg-white p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
                    <h2
                      className={`${
                        hasRequests
                          ? "text-[24px] sm:text-[32px]"
                          : "text-[26px] sm:text-[38px]"
                      } font-medium tracking-[-0.03em] text-black leading-[1.1] sm:leading-[1.08]`}
                    >
                      Need lab components for your build?
                    </h2>
                    <p className="mt-2.5 sm:mt-3 text-[14px] sm:text-[15px] text-black/60 leading-relaxed">
                      Select the required parts and quantities from your campus
                      lab catalog. Every request appears live as a visual
                      flowchart on your board.
                    </p>

                    <div className="mt-6 sm:mt-7">
                      <LoopsiiButton
                        label={
                          hasRequests
                            ? "Raise Another Request"
                            : "Raise a Request"
                        }
                        size="lg"
                        hideArrow
                        className="w-full sm:w-auto [&>span]:w-full sm:[&>span]:w-auto [&>span]:justify-center [&>span]:h-[52px] sm:[&>span]:h-[60px] [&>span]:px-5 sm:[&>span]:px-8 [&>span]:text-[15px] sm:[&>span]:text-[17px]"
                        onClick={() => setStage("parts")}
                      />
                    </div>
                  </div>
                </CanvasDraggableItem>
              </div>

              {/* Right 50%: Freehand Draggable Flowchart + 3-Request Cluster & Show More List */}
              {hasRequests && activeRequest && (
                <div className="flex flex-col justify-center min-w-0 p-4 pb-20 sm:p-10 space-y-4">
                  {/* Top Header + Compact 3-Request Cluster Switcher (only shown when 2+ requests) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                      <h3 className="text-[20px] sm:text-[22px] font-medium tracking-[-0.025em] text-black">
                        Your Request Flowcharts
                      </h3>
                      <p className="text-[13px] sm:text-[14px] text-black/55 tabular-nums">
                        {savedRequests.length} saved
                      </p>
                    </div>

                    {savedRequests.length >= 2 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {topClusterRequests.map((req, idx) => {
                          const reqNumber = savedRequests.length - 1 - idx;
                          const palette =
                            FLOW_PALETTES[reqNumber % FLOW_PALETTES.length];
                          const isCurrent = req.id === activeRequest.id;
                          const units = req.items.reduce(
                            (s, it) => s + it.requestedQuantity,
                            0
                          );
                          const isDone = req.status === "CLOSED";

                          return (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => setSelectedRequestId(req.id)}
                              style={{
                                backgroundColor: isCurrent
                                  ? palette.banner
                                  : "#FFFFFF",
                              }}
                              className={`min-h-[54px] sm:min-h-0 flex items-center justify-between gap-2.5 sm:gap-2 rounded-[14px] border-2 px-3.5 py-3 sm:py-2.5 text-left transition-all duration-200 cursor-pointer ${
                                isCurrent
                                  ? "border-black shadow-[3px_3px_0px_#000000] -translate-y-0.5"
                                  : "border-black/20 hover:border-black/60"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-black truncate">
                                  Request {reqNumber + 1}
                                </p>
                                <p className="text-[13px] text-black/65 truncate tabular-nums">
                                  {req.items.length} parts · {units} qty
                                </p>
                              </div>
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/25 bg-white/85 text-black"
                                title={isDone ? "Completed" : "Pending"}
                              >
                                {isDone ? (
                                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 stroke-[2.2]" />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Single Focused Excalidraw Flowchart (freely draggable up/down/around the canvas) */}
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

                  {/* "Show more" Below for 4+ Requests — Compact Selectable List */}
                  {overflowRequests.length > 0 && (
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => setShowMoreRequests((prev) => !prev)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-black/16 bg-white px-5 py-2 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] hover:border-black/30 cursor-pointer"
                      >
                        <span>
                          {showMoreRequests
                            ? "Hide earlier requests"
                            : `Show more (${overflowRequests.length} more request${
                                overflowRequests.length === 1 ? "" : "s"
                              })`}
                        </span>
                        {showMoreRequests ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {showMoreRequests && (
                          <motion.div
                            key="overflow-request-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: LP_EASE }}
                            className="w-full overflow-hidden"
                          >
                            <div
                              data-lenis-prevent
                              className="mt-3 max-h-56 overflow-y-auto rounded-[20px] border border-black/14 bg-white divide-y divide-black/10 shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
                            >
                              {overflowRequests.map((req, oIdx) => {
                                const reqNumber =
                                  savedRequests.length - 1 - (3 + oIdx);
                                const palette =
                                  FLOW_PALETTES[
                                    reqNumber % FLOW_PALETTES.length
                                  ];
                                const isCurrent = req.id === activeRequest.id;
                                const units = req.items.reduce(
                                  (s, it) => s + it.requestedQuantity,
                                  0
                                );
                                const isDone = req.status === "CLOSED";

                                return (
                                  <button
                                    key={req.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedRequestId(req.id);
                                      setShowMoreRequests(false);
                                    }}
                                    className={`min-h-[56px] flex w-full items-center justify-between gap-3 px-4 py-3.5 sm:py-3 text-left transition-colors cursor-pointer ${
                                      isCurrent
                                        ? "bg-[#F5F5F3]"
                                        : "hover:bg-[#F7F7F5]"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span
                                        style={{
                                          backgroundColor: palette.banner,
                                        }}
                                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-black"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-black truncate">
                                          Request {reqNumber + 1}
                                          {req.purpose
                                            ? ` · ${req.purpose}`
                                            : ""}
                                        </p>
                                        <p className="text-[13px] text-black/55 tabular-nums truncate">
                                          {req.items.length} parts ({units}{" "}
                                          units) · {req.instructor.fullName}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black/70 shrink-0">
                                      {isDone ? (
                                        <>
                                          <Check className="h-4 w-4 text-black" />
                                          Done
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="h-4 w-4 text-black" />
                                          Pending
                                        </>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* PARTS PICKER VIEW */}
          {stage === "parts" && (
            <motion.div
              key="stage-parts"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.6, ease: LP_EASE }}
              className="flex flex-1 flex-col min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100vh-8.5rem)]"
            >
              {/* Clean Editorial Header & Filters */}
              <div className="border-b border-black/12 bg-white/90 backdrop-blur-md px-4 py-4 sm:px-7 sm:py-5">
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setStage("board")}
                      className="inline-flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-black/15 bg-[#F0F0F0] text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
                      aria-label="Back to dashboard"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-[20px] sm:text-[26px] font-medium tracking-[-0.03em] text-black leading-tight">
                        Select Lab Parts
                      </h2>
                      <p className="mt-0.5 text-[13px] sm:text-[14px] text-black/55 tabular-nums leading-snug">
                        {filteredParts.length} verified parts available · Select parts below to submit from the bottom bar
                      </p>
                    </div>
                  </div>
                </div>

                {/* Search & Filter Row */}
                <div className="mt-3.5 sm:mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <div className="relative col-span-2 sm:flex-1 sm:min-w-[240px] sm:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search Arduino, DHT22, ESP32, servo, soldering..."
                      className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] pl-10 pr-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-11 w-full min-w-0 truncate rounded-full border border-black/15 bg-white px-3.5 sm:px-4 text-[13px] sm:text-[14px] font-medium text-black focus:border-black focus:outline-none sm:w-auto"
                  >
                    <option value="ALL">
                      All Categories ({categories.length})
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={labBlockFilter}
                    onChange={(e) => setLabBlockFilter(e.target.value)}
                    className="h-11 w-full min-w-0 truncate rounded-full border border-black/15 bg-white px-3.5 sm:px-4 text-[13px] sm:text-[14px] font-medium text-black focus:border-black focus:outline-none sm:w-auto"
                  >
                    <option value="ALL">All Lab Blocks</option>
                    {PROCUREMENT_LAB_BLOCKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* All Parts WebP Grid */}
              <div className="flex-1 p-4 sm:p-7 pb-36 sm:pb-28">
                {loading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-[22px] border border-black/12 bg-white"
                      >
                        <div className="lp-shimmer aspect-[4/3] w-full" />
                        <div className="p-4 space-y-2.5">
                          <div className="lp-shimmer h-4 w-28 rounded-md" />
                          <div className="lp-shimmer h-5 w-4/5 rounded-md" />
                          <div className="lp-shimmer h-11 w-full rounded-full mt-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredParts.length === 0 ? (
                  <p className="py-16 text-center text-[16px] text-black/55">
                    No parts match your search or filter.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                      {visibleParts.map((row) => (
                        <PartPickerCard
                          key={row.id}
                          row={row}
                          qty={selectedQty[row.itemId] ?? 0}
                          onToggle={togglePart}
                          onUpdateQty={updatePartQty}
                        />
                      ))}
                    </div>

                    {visibleCount < filteredParts.length && (
                      <div
                        ref={setSentinelEl}
                        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
                      >
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="overflow-hidden rounded-[22px] border border-black/12 bg-white"
                          >
                            <div className="lp-shimmer aspect-[4/3] w-full" />
                            <div className="p-4 space-y-2.5">
                              <div className="lp-shimmer h-4 w-28 rounded-md" />
                              <div className="lp-shimmer h-5 w-4/5 rounded-md" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DottedGridCanvas>
    </div>
  );
}
