"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Search, X } from "lucide-react";
import { LoopsiiButton } from "@/components/landing/primitives";
import {
  SmoothScrollProvider,
  useLenis,
} from "@/components/landing/smooth-scroll";
import { PartPickerCard } from "@/components/student/part-picker-card";
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
  prependLocalStudentRequest,
} from "@/lib/student-requests-store";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  ItemCategoryDTO,
} from "@/types/contracts";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const BATCH_SIZE = 24;

function BrowseInventoryInner() {
  const { user, isDemoMode } = useAuth();
  const { lenis } = useLenis();
  const [items, setItems] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [instructors, setInstructors] = useState<AuthUserDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "available">("name");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);

  // Direct in-place request selection (zero navigation to a separate page)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [instructorId, setInstructorId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmittedCount, setJustSubmittedCount] = useState<number | null>(
    null
  );

  // Hover-top / click-to-open floating request bar
  const [barVisible, setBarVisible] = useState(false);
  const [barFocused, setBarFocused] = useState(false);
  const pointerInsideBarRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      const demoInv = DEMO_CAMPUS_INVENTORY.filter(
        (i) => i.isVerified && i.isVisible
      );
      const demoInsts = DEMO_USERS.filter((u) => u.role === "INSTRUCTOR");
      setItems(demoInv);
      setCategories(DEMO_CATEGORIES);
      setInstructors(demoInsts);
      if (demoInsts.length > 0) setInstructorId(demoInsts[0].id);
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
    ])
      .then(([inv, cats, insts]) => {
        setItems(inv);
        setCategories(cats);
        setInstructors(insts);
        if (insts.length > 0) setInstructorId(insts[0].id);
      })
      .finally(() => setLoading(false));
  }, [isDemoMode]);

  const inventoryByItemId = useMemo(
    () => new Map(items.map((row) => [row.itemId, row])),
    [items]
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

  // Hovering top OR scrolling upward (with parts selected) reveals the invisible navbar;
  // moving cursor down or scrolling down hides it smoothly
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!pointerInsideBarRef.current && !barFocused) {
          setBarVisible(false);
        }
      }, 180);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 84) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setBarVisible(true);
      } else if (
        !pointerInsideBarRef.current &&
        !barFocused &&
        e.clientY > 150
      ) {
        scheduleHide();
      }
    };

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;
      lastScrollY = currentY;

      if (delta < -14 && selectedEntries.length > 0) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setBarVisible(true);
      } else if (delta > 18 && !pointerInsideBarRef.current && !barFocused) {
        scheduleHide();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [barFocused, selectedEntries.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((r) => {
      const meta = extractItemProcurementMeta(r.item.specifications);
      if (categoryFilter !== "ALL" && r.item.category.id !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.item.name.toLowerCase().includes(q) ||
        r.item.code.toLowerCase().includes(q) ||
        r.item.category.name.toLowerCase().includes(q) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false) ||
        (r.item.description?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...list].sort((a, b) =>
      sortBy === "available"
        ? b.availableQuantity - a.availableQuantity
        : a.item.name.localeCompare(b.item.name)
    );
  }, [items, search, categoryFilter, labBlockFilter, sortBy]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, categoryFilter, labBlockFilter, sortBy]);

  useEffect(() => {
    if (!sentinelEl || visibleCount >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) =>
            prev < filtered.length
              ? Math.min(filtered.length, prev + BATCH_SIZE)
              : prev
          );
        }
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [sentinelEl, visibleCount, filtered.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [visibleCount, filtered.length, lenis]);

  const visibleParts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const togglePart = useCallback((row: CampusInventoryDTO) => {
    if (row.availableQuantity <= 0) return;
    setJustSubmittedCount(null);
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
      setJustSubmittedCount(null);
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

  const handleSubmitDirect = async () => {
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

    setSubmitting(true);
    try {
      if (isDemoMode) {
        const localReq = buildLocalLabRequestDTO({
          user,
          instructor: chosenInstructor,
          instructorId,
          purpose: cleanPurpose,
          entries: selectedEntries,
        });
        prependLocalStudentRequest(localReq);
      } else {
        await apiClient.requests.create({
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
      }

      const unitCount = totalSelectedUnits;
      setSelectedQty({});
      setPurpose("");
      setBarVisible(false);
      setBarFocused(false);
      setJustSubmittedCount(unitCount);
      toast.success("Request raised — track live on My Requests or Dashboard");
    } catch {
      const localReq = buildLocalLabRequestDTO({
        user,
        instructor: chosenInstructor,
        instructorId,
        purpose: cleanPurpose,
        entries: selectedEntries,
      });
      prependLocalStudentRequest(localReq);
      const unitCount = totalSelectedUnits;
      setSelectedQty({});
      setPurpose("");
      setBarVisible(false);
      setBarFocused(false);
      setJustSubmittedCount(unitCount);
      toast.success("Request raised — track live on My Requests or Dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  const isRequestBarOpen = barVisible || barFocused;

  return (
    <div
      className="space-y-6"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Floating Hover-Top Request Submission Bar (zero navigation away from catalog) */}
      <AnimatePresence>
        {isRequestBarOpen && (
          <motion.nav
            key="inventory-hover-request-bar"
            aria-label="Direct request submission bar"
            initial={{ opacity: 0, y: -104 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -104 }}
            transition={{ duration: 0.48, ease: LP_EASE }}
            onMouseEnter={() => {
              pointerInsideBarRef.current = true;
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setBarVisible(true);
            }}
            onMouseLeave={() => {
              pointerInsideBarRef.current = false;
              if (!barFocused) {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                  if (!pointerInsideBarRef.current && !barFocused) {
                    setBarVisible(false);
                  }
                }, 180);
              }
            }}
            onFocusCapture={() => setBarFocused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setBarFocused(false);
                if (!pointerInsideBarRef.current) {
                  setBarVisible(false);
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
                      } ready to request`
                    : "Add parts from the catalog below to raise a request directly"}
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
                  placeholder="Project or lab course purpose (optional)..."
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
                          ? `Raise Request (${totalSelectedUnits})`
                          : "Raise Request"
                    }
                    size="md"
                    hideArrow
                    onClick={handleSubmitDirect}
                  />
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Clean Editorial Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-medium tracking-[-0.03em] text-black leading-tight">
            Browse Inventory
          </h1>
          <p className="mt-1 text-[15px] text-black/60">
            Select any parts and quantities right here — hover the top edge
            anytime to submit directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {selectedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setBarVisible(true)}
              className="text-[15px] font-medium text-black underline decoration-black/35 underline-offset-4 hover:decoration-black transition-colors cursor-pointer tabular-nums"
            >
              {selectedEntries.length} selected ({totalSelectedUnits} units) —
              Review &amp; Submit
            </button>
          )}
          <Link
            href="/student/requests"
            className="text-[15px] font-medium text-black/65 hover:text-black transition-colors"
          >
            Track My Requests
          </Link>
        </div>
      </div>

      {/* Subtle Inline Confirmation Banner Right After Direct Submission */}
      <AnimatePresence>
        {justSubmittedCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: LP_EASE }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-black/14 bg-white px-5 py-3.5"
          >
            <div className="flex items-center gap-3 text-[15px] text-black">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C4F041] border border-black/15">
                <CheckCircle2 className="h-4 w-4 text-black" />
              </span>
              <span>
                Request for <strong>{justSubmittedCount} units</strong> raised
                and sent for approval.
              </span>
            </div>
            <div className="flex items-center gap-5 text-[14px] font-medium">
              <Link
                href="/student/dashboard"
                className="text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
              >
                View Flowchart
              </Link>
              <Link
                href="/student/requests"
                className="text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
              >
                Track in My Requests
              </Link>
              <button
                type="button"
                onClick={() => setJustSubmittedCount(null)}
                className="text-black/45 hover:text-black cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-black/12 bg-white p-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Arduino, Raspberry Pi, sensors, lab block..."
            className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] pl-10 pr-4 text-[14px] text-black placeholder:text-black/45 focus:border-black focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-11 rounded-full border border-black/15 bg-white px-4 text-[14px] font-medium text-black focus:border-black focus:outline-none"
        >
          <option value="ALL">All Categories ({categories.length})</option>
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
          {PROCUREMENT_LAB_BLOCKS.map((block) => (
            <option key={block} value={block}>
              {block}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "available")}
          className="h-11 rounded-full border border-black/15 bg-white px-4 text-[14px] font-medium text-black focus:border-black focus:outline-none"
        >
          <option value="name">Sort: Name (A–Z)</option>
          <option value="available">Sort: Most Available</option>
        </select>

        <span className="ml-auto text-[14px] text-black/55 tabular-nums">
          {filtered.length} parts
        </span>
      </div>

      {/* Parts Grid with Shimmer Loaders & Progressive Batching */}
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
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-[16px] text-black/55">
          No lab equipment matches your search or lab block filter.
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleParts.map((row) => (
              <PartPickerCard
                key={row.id}
                row={row}
                qty={selectedQty[row.itemId] ?? 0}
                selectLabel="Add to Request"
                onToggle={togglePart}
                onUpdateQty={updatePartQty}
              />
            ))}
          </div>

          {visibleCount < filtered.length && (
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
  );
}

export default function StudentInventoryBrowsePage() {
  return (
    <SmoothScrollProvider>
      <BrowseInventoryInner />
    </SmoothScrollProvider>
  );
}
