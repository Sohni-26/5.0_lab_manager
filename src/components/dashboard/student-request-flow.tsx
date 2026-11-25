"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, Minus, Plus, Search, X } from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { RequestFlowchartCard } from "@/components/dashboard/request-flowchart";
import { LoopsiiButton } from "@/components/landing/primitives";
import { useLenis } from "@/components/landing/smooth-scroll";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_CAMPUS_INVENTORY,
  DEMO_CATEGORIES,
  DEMO_USERS,
} from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  ItemCategoryDTO,
  LabRequestDTO,
} from "@/types/contracts";

type FlowStage = "board" | "parts";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const BATCH_SIZE = 24;
const STORAGE_KEY = "campuslab_student_flowcharts_v1";

/** Smooth WebP image with GPU-accelerated shimmer loader and fade-in */
const ShimmerPartImage = React.memo(function ShimmerPartImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (
      imgRef.current &&
      imgRef.current.complete &&
      imgRef.current.naturalWidth > 0
    ) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E6E6E2]">
      {!loaded && (
        <div className="lp-shimmer absolute inset-0" aria-hidden="true" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-[1.04] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});

/** Clean editorial part item — zero tiny tags or micro-badges, landing-page DM Sans typography */
const PartTile = React.memo(function PartTile({
  row,
  qty,
  onToggle,
  onUpdateQty,
}: {
  row: CampusInventoryDTO;
  qty: number;
  onToggle: (row: CampusInventoryDTO) => void;
  onUpdateQty: (row: CampusInventoryDTO, nextVal: number) => void;
}) {
  const isSelected = qty > 0;
  const outOfStock = row.availableQuantity <= 0;
  const meta = extractItemProcurementMeta(row.item.specifications);
  const imgSrc =
    row.item.imageUrl || getPartImageUrl(row.item.code, row.item.category.slug);

  return (
    <article
      className={`part-card-perf group flex flex-col justify-between overflow-hidden rounded-[22px] border bg-white transition-[border-color,box-shadow] duration-200 ${
        isSelected
          ? "border-black ring-2 ring-[#C4F041] shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
          : "border-black/14 hover:border-black/35"
      } ${outOfStock ? "opacity-55" : ""}`}
    >
      {/* Clickable Photo + Clean Editorial Copy */}
      <div
        role="button"
        tabIndex={outOfStock ? -1 : 0}
        onClick={() => onToggle(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(row);
          }
        }}
        className={outOfStock ? "cursor-not-allowed" : "cursor-pointer"}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-black/10">
          <ShimmerPartImage src={imgSrc} alt={row.item.name} />
          {isSelected && (
            <span className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black">
              <Check className="h-4 w-4 stroke-[2.5]" />
            </span>
          )}
        </div>

        <div className="px-4 pt-4 pb-3 space-y-1.5">
          <p className="text-[13px] font-medium text-black/50">
            {row.item.category.name}
            {meta.labBlock ? ` · ${meta.labBlock}` : ""}
          </p>

          <h3 className="text-[16px] font-medium tracking-[-0.02em] text-black leading-snug line-clamp-2 min-h-[2.75rem]">
            {row.item.name}
          </h3>

          <p className="text-[14px] text-black/60 tabular-nums">
            {outOfStock
              ? "Currently out of stock"
              : `${row.availableQuantity} ${row.item.unit} available`}
          </p>
        </div>
      </div>

      {/* Quantity Selection Row */}
      <div className="px-4 pb-4 pt-1">
        {outOfStock ? (
          <p className="py-2 text-center text-[14px] font-medium text-black/40">
            Unavailable
          </p>
        ) : !isSelected ? (
          <button
            type="button"
            onClick={() => onUpdateQty(row, 1)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/16 bg-[#F0F0F0] text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] hover:border-black/25 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Select
          </button>
        ) : (
          <div className="flex h-11 items-center justify-between rounded-full border border-black bg-black px-1.5 text-white">
            <button
              type="button"
              onClick={() => onUpdateQty(row, qty - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 text-[14px] tabular-nums">
              <input
                type="number"
                min={1}
                max={row.availableQuantity}
                value={qty}
                onChange={(e) => onUpdateQty(row, Number(e.target.value) || 1)}
                aria-label={`Quantity for ${row.item.name}`}
                className="w-12 bg-transparent text-center font-semibold text-[#C4F041] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-white/60">of {row.availableQuantity}</span>
            </div>

            <button
              type="button"
              onClick={() => onUpdateQty(row, qty + 1)}
              disabled={qty >= row.availableQuantity}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C4F041] text-black transition-opacity hover:opacity-90 disabled:opacity-35 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});

export function StudentRequestFlow() {
  const { user, isDemoMode } = useAuth();
  const { lenis, scrollTo } = useLenis();
  const [stage, setStage] = useState<FlowStage>("board");
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [instructors, setInstructors] = useState<AuthUserDTO[]>([]);
  const [savedRequests, setSavedRequests] = useState<LabRequestDTO[]>([]);
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

  // Dashboard-only fixed hover-top navbar (pure hover top reveal / hover down hide)
  const [navVisible, setNavVisible] = useState(false);
  const [navFocused, setNavFocused] = useState(false);
  const pointerInsideNavRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as LabRequestDTO[];
          if (Array.isArray(parsed)) setSavedRequests(parsed);
        }
      } catch {
        // ignore storage errors
      }
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
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [isDemoMode]
  );

  // Hovering top reveals the fixed dashboard navbar; moving down hides it smoothly
  useEffect(() => {
    if (stage !== "parts") {
      setNavVisible(false);
      return;
    }

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!pointerInsideNavRef.current && !navFocused) {
          setNavVisible(false);
        }
      }, 180);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 68) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setNavVisible(true);
      } else if (!pointerInsideNavRef.current && !navFocused && e.clientY > 140) {
        scheduleHide();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [stage, navFocused]);

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
    const nowIso = new Date().toISOString();

    const buildLocalRequestDTO = (): LabRequestDTO => ({
      id: `req-local-${Date.now()}`,
      requestCode: `REQ-${Date.now().toString(36).toUpperCase()}`,
      campusId: user?.campusId ?? "demo-campus-01",
      studentId: user?.id ?? "demo-user-stu-01",
      instructorId: chosenInstructor?.id ?? instructorId,
      purpose: cleanPurpose,
      status: "PENDING_INSTRUCTOR",
      rejectionReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      campus: {
        id: user?.campusId ?? "demo-campus-01",
        code: user?.campus?.code ?? "CMP-01",
        name: user?.campus?.name ?? "Bengaluru North Campus",
      },
      student: {
        id: user?.id ?? "demo-user-stu-01",
        fullName: user?.fullName ?? "Aarav Nair",
        email: user?.email ?? "student1.cmp01@campuslab.edu",
        institutionalId: user?.institutionalId ?? "STU-0101",
      },
      instructor: {
        id: chosenInstructor?.id ?? "demo-user-inst-01",
        fullName: chosenInstructor?.fullName ?? "Prof. Ananya Deshmukh",
        email: chosenInstructor?.email ?? "instructor1.cmp01@campuslab.edu",
        institutionalId: chosenInstructor?.institutionalId ?? "INS-0101",
      },
      items: selectedEntries.map(({ itemId, qty, row }, idx) => ({
        id: `req-item-${Date.now()}-${idx}`,
        requestId: `req-local-${Date.now()}`,
        itemId,
        requestedQuantity: qty,
        approvedQuantity: 0,
        issuedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: {
          id: row.item.id,
          code: row.item.code,
          name: row.item.name,
          unit: row.item.unit,
          imageUrl:
            row.item.imageUrl ||
            getPartImageUrl(row.item.code, row.item.category.slug),
        },
        photos: [],
      })),
      approvals: [],
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

      toast.success("Request added to your dashboard flowchart");
      setSelectedQty({});
      setPurpose("");
      setNavVisible(false);
      setNavFocused(false);
      setStage("board");
    } catch {
      const createdReq = buildLocalRequestDTO();
      setSavedRequests((prev) => {
        const next = [createdReq, ...prev];
        persistDemoRequests(next);
        return next;
      });
      toast.success("Request added to your dashboard flowchart");
      setSelectedQty({});
      setPurpose("");
      setNavVisible(false);
      setNavFocused(false);
      setStage("board");
    } finally {
      setSubmitting(false);
    }
  };

  const isHoverBarOpen = stage === "parts" && (navVisible || navFocused);
  const hasRequests = savedRequests.length > 0;
  const isClustered = savedRequests.length >= 2;

  return (
    <div
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* DASHBOARD-ONLY FIXED HOVER-TOP NAVBAR (MATCHING LANDING NAVMORPH) */}
      <AnimatePresence>
        {isHoverBarOpen && (
          <motion.nav
            key="dashboard-hover-navbar"
            aria-label="Request submission bar"
            initial={{ opacity: 0, y: -104 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -104 }}
            transition={{ duration: 0.48, ease: LP_EASE }}
            onMouseEnter={() => {
              pointerInsideNavRef.current = true;
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setNavVisible(true);
            }}
            onMouseLeave={() => {
              pointerInsideNavRef.current = false;
              if (!navFocused) {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                  if (!pointerInsideNavRef.current && !navFocused) {
                    setNavVisible(false);
                  }
                }, 180);
              }
            }}
            onFocusCapture={() => setNavFocused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setNavFocused(false);
                if (!pointerInsideNavRef.current) {
                  setNavVisible(false);
                }
              }
            }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,1060px)] rounded-[24px] border border-black/15 bg-[#F0F0F0]/95 backdrop-blur-md px-5 sm:px-6 py-4 text-black shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
          >
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] font-medium tracking-[-0.02em] text-black tabular-nums">
                  {selectedEntries.length > 0
                    ? `${selectedEntries.length} part${
                        selectedEntries.length === 1 ? "" : "s"
                      } selected · ${totalSelectedUnits} unit${
                        totalSelectedUnits === 1 ? "" : "s"
                      } total`
                    : "Select parts below to build your request"}
                </p>

                {selectedEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedQty({})}
                    className="text-[14px] font-medium text-black/55 hover:text-black transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {selectedEntries.length > 0 && (
                <div
                  data-lenis-prevent
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 max-h-20 overflow-y-auto border-y border-black/10 py-2.5 text-[14px] text-black"
                >
                  {selectedEntries.map(({ itemId, qty, row }) => (
                    <span
                      key={itemId}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span className="font-medium max-w-[200px] truncate">
                        {row.item.name}
                      </span>
                      <span className="text-black/55 tabular-nums">×{qty}</span>
                      <button
                        type="button"
                        onClick={() => updatePartQty(row, 0)}
                        className="text-black/40 hover:text-black transition-colors cursor-pointer"
                        aria-label={`Remove ${row.item.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="h-12 rounded-full border border-black/16 bg-white px-4 text-[14px] font-medium text-black focus:border-black focus:outline-none min-w-[220px]"
                >
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.fullName}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Project or lab course purpose..."
                  className="h-12 flex-1 min-w-[220px] rounded-full border border-black/16 bg-white px-5 text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
                />

                <div
                  className={
                    selectedEntries.length === 0
                      ? "opacity-45 pointer-events-none"
                      : ""
                  }
                >
                  <LoopsiiButton
                    label={
                      submitting
                        ? "Submitting..."
                        : selectedEntries.length > 0
                          ? `Submit Request (${totalSelectedUnits})`
                          : "Submit Request"
                    }
                    size="md"
                    hideArrow
                    onClick={handleSubmitRequest}
                  />
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <DottedGridCanvas className="flex flex-col">
        <AnimatePresence mode="wait">
          {/* MAIN STUDENT BOARD: EXACT 50/50 INVISIBLE SPLIT — CENTERED LEFT PROMPT + RIGHT FLOWCHARTS */}
          {stage === "board" && (
            <motion.div
              key="stage-board"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: LP_EASE }}
              className={`flex-1 min-h-[calc(100vh-8.5rem)] ${
                hasRequests
                  ? "grid grid-cols-1 lg:grid-cols-2"
                  : "flex items-center justify-center p-6 sm:p-8"
              }`}
            >
              {/* Left 50%: Vertically & Horizontally Centered Prompt Card (no visible divider) */}
              <div
                className={
                  hasRequests
                    ? "flex items-center justify-center p-6 sm:p-10 lg:sticky lg:top-0 lg:h-[calc(100vh-8.5rem)]"
                    : "w-full max-w-xl"
                }
              >
                <div className="w-full max-w-md rounded-[24px] border border-black/14 bg-white p-8 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
                  <h2
                    className={`${
                      hasRequests
                        ? "text-[28px] sm:text-[32px]"
                        : "text-[32px] sm:text-[38px]"
                    } font-medium tracking-[-0.03em] text-black leading-[1.08]`}
                  >
                    Need lab components for your build?
                  </h2>
                  <p className="mt-3 text-[15px] text-black/60 leading-relaxed">
                    Select the required parts and quantities from your campus
                    lab catalog. Every request appears live as a visual
                    flowchart on your board.
                  </p>

                  <div className="mt-7">
                    <LoopsiiButton
                      label={
                        hasRequests ? "Raise Another Request" : "Raise a Request"
                      }
                      size="lg"
                      hideArrow
                      onClick={() => setStage("parts")}
                    />
                  </div>
                </div>
              </div>

              {/* Right 50%: Balanced Excalidraw Flowchart Canvas Area */}
              {hasRequests && (
                <div className="flex flex-col justify-center p-6 sm:p-10 space-y-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-2">
                    <div>
                      <h3 className="text-[22px] font-medium tracking-[-0.025em] text-black">
                        Your Request Flowcharts
                      </h3>
                      <p className="text-[14px] text-black/55">
                        {savedRequests.length} active request
                        {savedRequests.length === 1 ? "" : "s"} saved on your
                        dashboard
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-8">
                    {savedRequests.map((req, idx) => (
                      <RequestFlowchartCard
                        key={req.id}
                        request={req}
                        index={savedRequests.length - 1 - idx}
                        compactMode={isClustered}
                        defaultExpanded={idx === 0}
                      />
                    ))}
                  </div>
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
              className="flex flex-1 flex-col min-h-[calc(100vh-8.5rem)]"
            >
              {/* Clean Editorial Header & Filters */}
              <div className="border-b border-black/12 bg-white/90 backdrop-blur-md px-5 sm:px-7 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setStage("board")}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-[#F0F0F0] text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
                      aria-label="Back to dashboard"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <h2 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black leading-tight">
                        Select Lab Parts
                      </h2>
                      <p className="mt-0.5 text-[14px] text-black/55 tabular-nums">
                        {filteredParts.length} verified parts available · Hover
                        the top edge to review and submit
                      </p>
                    </div>
                  </div>

                  {selectedEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNavVisible(true)}
                      className="text-[15px] font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black transition-colors cursor-pointer tabular-nums"
                    >
                      {selectedEntries.length} selected ({totalSelectedUnits}{" "}
                      units)
                    </button>
                  )}
                </div>

                {/* Search & Filter Row */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search Arduino, DHT22, ESP32, servo, soldering..."
                      className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] pl-10 pr-4 text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-11 rounded-full border border-black/15 bg-white px-4 text-[14px] font-medium text-black focus:border-black focus:outline-none"
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
                    className="h-11 rounded-full border border-black/15 bg-white px-4 text-[14px] font-medium text-black focus:border-black focus:outline-none"
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
              <div className="flex-1 p-5 sm:p-7 pb-16">
                {loading ? (
                  <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {visibleParts.map((row) => (
                        <PartTile
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
                        className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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
