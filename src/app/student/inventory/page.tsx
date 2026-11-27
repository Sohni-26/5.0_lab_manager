"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  SmoothScrollProvider,
  useLenis,
} from "@/components/landing/smooth-scroll";
import { PartPickerCard } from "@/components/student/part-picker-card";
import { StudentRequestDock } from "@/components/student/request-dock";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_CATEGORIES,
  DEMO_USERS,
} from "@/lib/demo-data";
import { loadDemoCampusInventory } from "@/lib/lab-manager-store";
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  const loadInventory = useCallback(() => {
    if (isDemoMode) {
      const demoInv = loadDemoCampusInventory().filter(
        (i) => i.isVerified && i.isVisible
      );
      const demoInsts = DEMO_USERS.filter((u) => u.role === "INSTRUCTOR");
      setItems(demoInv);
      setCategories(DEMO_CATEGORIES);
      setInstructors(demoInsts);
      setInstructorId((prev) => prev || (demoInsts[0]?.id ?? ""));
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.inventory
        .list({ pageSize: 250 })
        .then((r) => r.data.filter((i) => i.isVerified && i.isVisible))
        .catch(() =>
          loadDemoCampusInventory().filter((i) => i.isVerified && i.isVisible)
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
        setInstructorId((prev) => prev || (insts[0]?.id ?? ""));
      })
      .finally(() => setLoading(false));
  }, [isDemoMode]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: ["inventory.updated", "inventory.visibility_changed", "allocation.verified"],
    onEvent: () => {
      loadInventory();
    },
    onReconnect: () => {
      loadInventory();
    },
  });

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
      setJustSubmittedCount(unitCount);
      toast.success("Request raised — track live on My Requests or Dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  const activeFilterCount =
    (categoryFilter !== "ALL" ? 1 : 0) +
    (labBlockFilter !== "ALL" ? 1 : 0) +
    (sortBy !== "name" ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || search.trim().length > 0;

  const activeCategoryName = useMemo(
    () => categories.find((c) => c.id === categoryFilter)?.name ?? null,
    [categories, categoryFilter]
  );

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setCategoryFilter("ALL");
    setLabBlockFilter("ALL");
    setSortBy("name");
  }, []);

  return (
    <div
      className="space-y-4 sm:space-y-6 pb-36 sm:pb-28"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Always-Visible Floating Bottom Request Dock (zero navigation away from catalog) */}
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
        onSubmit={handleSubmitDirect}
        submitting={submitting}
        submitLabel="Raise Request"
      />

      {/* Clean Editorial Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[34px] font-medium tracking-[-0.03em] text-black leading-tight">
            Browse Inventory
          </h1>
          <p className="mt-1 text-[13.5px] sm:text-[15px] text-black/60 leading-snug">
            Select any parts and quantities right here — submit directly from
            the floating bar below.
          </p>
        </div>

        <Link
          href="/student/requests"
          className="inline-flex min-h-[40px] sm:min-h-0 items-center rounded-full border border-black/14 bg-white px-3.5 text-[13.5px] font-medium text-black/80 transition-colors hover:border-black/30 hover:text-black sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:text-[15px] sm:text-black/65"
        >
          Track My Requests
        </Link>
      </div>

      {/* Subtle Inline Confirmation Banner Right After Direct Submission */}
      <AnimatePresence>
        {justSubmittedCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: LP_EASE }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] sm:rounded-[20px] border border-black/14 bg-white px-3.5 py-3 sm:px-5 sm:py-3.5"
          >
            <div className="flex items-center gap-2.5 sm:gap-3 text-[13.5px] sm:text-[15px] text-black">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C4F041] border border-black/15">
                <CheckCircle2 className="h-4 w-4 text-black" />
              </span>
              <span>
                Request for <strong>{justSubmittedCount} units</strong> raised
                and sent for approval.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-[13.5px] sm:text-[14px] font-medium">
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
                className="flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center text-black/45 hover:text-black cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soft Responsive Filter Bar (collapsible controls on mobile, single inline bar on sm+) */}
      <div className="rounded-[24px] sm:rounded-[28px] bg-white ring-1 ring-black/[0.04] shadow-[0_6px_24px_rgba(0,0,0,0.04)] p-3 sm:p-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        {/* Full-width search bar on top for mobile, flexible pill on sm+ */}
        <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Arduino, Raspberry Pi, sensors, lab block..."
            className="min-h-[44px] h-11 w-full rounded-full border border-transparent bg-[#F5F5F2] pl-10 pr-10 sm:pr-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 transition-colors focus:border-black/20 focus:bg-white focus:outline-none"
          />
          {search.length > 0 && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-black/45 hover:bg-black/8 hover:text-black cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Mobile compact filter toggle row */}
        <div className="mt-2.5 flex items-center justify-between gap-2 sm:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-expanded={mobileFiltersOpen}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors cursor-pointer ${
                mobileFiltersOpen || activeFilterCount > 0
                  ? "border-black bg-black text-white"
                  : "border-black/15 bg-[#F7F7F5] text-black"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C4F041] px-1.5 text-[11px] font-semibold text-black tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  mobileFiltersOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-[44px] items-center px-2.5 text-[13px] font-medium text-black/60 hover:text-black cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-[13px] font-medium text-black/55 tabular-nums whitespace-nowrap">
            {filtered.length} parts
          </span>
        </div>

        {/* Active filter summary pills when collapsed on mobile */}
        {!mobileFiltersOpen && activeFilterCount > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
            {activeCategoryName && (
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
              >
                <span className="max-w-[160px] truncate">
                  {activeCategoryName}
                </span>
                <X className="h-3 w-3 text-black/55" />
              </button>
            )}
            {labBlockFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setLabBlockFilter("ALL")}
                className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
              >
                <span>{labBlockFilter}</span>
                <X className="h-3 w-3 text-black/55" />
              </button>
            )}
            {sortBy !== "name" && (
              <button
                type="button"
                onClick={() => setSortBy("name")}
                className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
              >
                <span>Most Available</span>
                <X className="h-3 w-3 text-black/55" />
              </button>
            )}
          </div>
        )}

        {/* Filter Controls: Collapsible 2-col drawer on mobile, seamless inline flex children on sm+ */}
        <div
          className={`${
            mobileFiltersOpen ? "mt-2.5 grid grid-cols-2 gap-2" : "hidden"
          } sm:mt-0 sm:contents`}
        >
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="col-span-2 min-h-[44px] h-11 w-full rounded-[16px] border border-transparent bg-[#F5F5F2] px-3.5 text-[15px] font-medium text-black transition-colors hover:bg-[#ECECE8] focus:border-black/20 focus:bg-white focus:outline-none sm:w-auto sm:rounded-full sm:px-4 sm:text-[14px]"
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
            aria-label="Filter by lab block"
            className="min-h-[44px] h-11 w-full rounded-[16px] border border-transparent bg-[#F5F5F2] px-3 text-[14px] font-medium text-black transition-colors hover:bg-[#ECECE8] focus:border-black/20 focus:bg-white focus:outline-none sm:w-auto sm:rounded-full sm:px-4"
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
            aria-label="Sort inventory"
            className="min-h-[44px] h-11 w-full rounded-[16px] border border-transparent bg-[#F5F5F2] px-3 text-[14px] font-medium text-black transition-colors hover:bg-[#ECECE8] focus:border-black/20 focus:bg-white focus:outline-none sm:w-auto sm:rounded-full sm:px-4"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="available">Sort: Most Available</option>
          </select>
        </div>

        <span className="hidden sm:inline sm:ml-auto text-[14px] text-black/55 tabular-nums">
          {filtered.length} parts
        </span>
      </div>

      {/* Parts Grid with Shimmer Loaders & Progressive Batching */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[24px] sm:rounded-[28px] bg-white p-2 pb-3 sm:p-2.5 sm:pb-3.5 ring-1 ring-black/[0.04] shadow-[0_8px_28px_rgba(0,0,0,0.045)]"
            >
              <div className="lp-shimmer aspect-[4/3] w-full rounded-[18px] sm:rounded-[20px]" />
              <div className="px-1.5 pt-2.5 sm:px-2 sm:pt-3 space-y-2">
                <div className="lp-shimmer h-3.5 w-20 sm:w-28 rounded-full" />
                <div className="lp-shimmer h-4 w-4/5 rounded-full" />
                <div className="flex items-center justify-between pt-2">
                  <div className="lp-shimmer h-3.5 w-14 rounded-full" />
                  <div className="lp-shimmer h-9 w-20 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 sm:py-16 text-center space-y-3">
          <p className="text-[15px] sm:text-[16px] text-black/55">
            No lab equipment matches your search or lab block filter.
          </p>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-black/20 bg-white px-5 text-[14px] font-medium text-black hover:bg-[#C4F041] transition-colors cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
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
              className="mt-4 sm:mt-6 grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[24px] sm:rounded-[28px] bg-white p-2 pb-3 sm:p-2.5 sm:pb-3.5 ring-1 ring-black/[0.04] shadow-[0_8px_28px_rgba(0,0,0,0.045)]"
                >
                  <div className="lp-shimmer aspect-[4/3] w-full rounded-[18px] sm:rounded-[20px]" />
                  <div className="px-1.5 pt-2.5 sm:px-2 sm:pt-3 space-y-2">
                    <div className="lp-shimmer h-3.5 w-20 sm:w-28 rounded-full" />
                    <div className="lp-shimmer h-4 w-4/5 rounded-full" />
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
