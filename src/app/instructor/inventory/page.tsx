"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  TableProperties,
  X,
} from "lucide-react";
import {
  SmoothScrollProvider,
  useLenis,
} from "@/components/landing/smooth-scroll";
import { ShimmerPartImage } from "@/components/student/part-picker-card";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_CATEGORIES } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import type { CampusInventoryDTO, ItemCategoryDTO } from "@/types/contracts";

const BATCH_SIZE = 24;

type StockStatusFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type SortOption = "name" | "available" | "borrowed";
type ViewMode = "cards" | "sheet";

const STOCK_STATUS_LABELS: Record<StockStatusFilter, string> = {
  ALL: "All Stock",
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

const SORT_LABELS: Record<SortOption, string> = {
  name: "Name (A–Z)",
  available: "Most Available",
  borrowed: "Most Borrowed",
};

function getStockState(availableQuantity: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (availableQuantity > 3) return "IN_STOCK";
  if (availableQuantity > 0) return "LOW_STOCK";
  return "OUT_OF_STOCK";
}

/** Visual WebP hardware card tailored for Instructor stock visibility */
const InstructorPartCard = React.memo(function InstructorPartCard({
  row,
}: {
  row: CampusInventoryDTO;
}) {
  const stockState = getStockState(row.availableQuantity);
  const outOfStock = stockState === "OUT_OF_STOCK";
  const isLowStock = stockState === "LOW_STOCK";
  const meta = extractItemProcurementMeta(row.item.specifications);
  const imgSrc =
    row.item.imageUrl || getPartImageUrl(row.item.code, row.item.category.slug);

  return (
    <article
      className={`part-card-perf group flex min-w-0 flex-col justify-between overflow-hidden rounded-[18px] sm:rounded-[22px] border border-black/12 bg-white transition-[border-color,box-shadow] duration-200 hover:border-black/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${
        outOfStock ? "opacity-70" : ""
      }`}
    >
      {/* WebP Hardware Photo + Clean Editorial Copy */}
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-black/10">
          <ShimmerPartImage src={imgSrc} alt={row.item.name} />
        </div>

        <div className="px-2.5 pt-2.5 pb-2 space-y-1 sm:px-4 sm:pt-4 sm:pb-3 sm:space-y-1.5">
          <p className="text-[12px] sm:text-[13px] font-medium text-black/50 truncate">
            {row.item.category.name}
            {meta.labBlock ? ` · ${meta.labBlock}` : ""}
          </p>

          <h3 className="text-[14px] sm:text-[16px] font-medium tracking-[-0.02em] text-black leading-[1.3] sm:leading-snug line-clamp-2 min-h-[2.3rem] sm:min-h-[2.75rem]">
            {row.item.name}
          </h3>
        </div>
      </div>

      {/* Live Stock Telemetry Footer */}
      <div className="px-2.5 pb-2.5 pt-1 sm:px-4 sm:pb-4 sm:pt-1.5">
        <div className="flex items-center justify-between gap-1.5 pb-2">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                outOfStock
                  ? "bg-black/25"
                  : isLowStock
                    ? "bg-[#F59E0B]"
                    : "bg-[#C4F041] ring-1 ring-black/25"
              }`}
              aria-hidden="true"
            />
            <span
              className={`truncate text-[12.5px] sm:text-[14px] font-semibold tabular-nums ${
                outOfStock ? "text-black/45" : "text-black"
              }`}
            >
              {outOfStock
                ? "Out of stock"
                : `${row.availableQuantity} available`}
            </span>
          </div>

          {isLowStock && (
            <span className="hidden sm:inline shrink-0 text-[12px] font-medium text-[#B45309]">
              Low
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 rounded-[12px] border border-black/8 bg-[#F7F7F5] px-2 py-1.5 sm:rounded-[14px] sm:px-3 sm:py-2">
          <div className="min-w-0">
            <p className="text-[12px] text-black/50 truncate leading-tight">
              Reserved
            </p>
            <p className="mt-0.5 text-[13px] sm:text-[14px] font-semibold text-black tabular-nums leading-tight">
              {row.reservedQuantity}
            </p>
          </div>
          <div className="min-w-0 border-l border-black/10 pl-2 sm:pl-3">
            <p className="text-[12px] text-black/50 truncate leading-tight">
              Borrowed
            </p>
            <p className="mt-0.5 text-[13px] sm:text-[14px] font-semibold text-black tabular-nums leading-tight">
              {row.borrowedQuantity}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
});

function InstructorInventoryInner() {
  const { isDemoMode } = useAuth();
  const { lenis } = useLenis();

  const [items, setItems] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<StockStatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (isDemoMode) {
      setItems(DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible));
      setCategories(DEMO_CATEGORIES);
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
    ])
      .then(([inv, cats]) => {
        if (cancelled) return;
        setItems(inv);
        setCategories(cats);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const summary = useMemo(() => {
    let availableUnits = 0;
    let reservedUnits = 0;
    let borrowedUnits = 0;

    for (const row of items) {
      availableUnits += row.availableQuantity;
      reservedUnits += row.reservedQuantity;
      borrowedUnits += row.borrowedQuantity;
    }

    return {
      totalParts: items.length,
      availableUnits,
      reservedUnits,
      borrowedUnits,
    };
  }, [items]);

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
      if (stockFilter !== "ALL" && getStockState(r.availableQuantity) !== stockFilter) {
        return false;
      }
      if (!q) return true;

      return (
        r.item.name.toLowerCase().includes(q) ||
        r.item.code.toLowerCase().includes(q) ||
        (r.item.brand?.toLowerCase().includes(q) ?? false) ||
        r.item.category.name.toLowerCase().includes(q) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "available") {
        return (
          b.availableQuantity - a.availableQuantity ||
          a.item.name.localeCompare(b.item.name)
        );
      }
      if (sortBy === "borrowed") {
        return (
          b.borrowedQuantity - a.borrowedQuantity ||
          a.item.name.localeCompare(b.item.name)
        );
      }
      return a.item.name.localeCompare(b.item.name);
    });
  }, [items, search, categoryFilter, labBlockFilter, stockFilter, sortBy]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, categoryFilter, labBlockFilter, stockFilter, sortBy]);

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
  }, [visibleCount, filtered.length, viewMode, lenis]);

  const visibleParts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const activeFilterCount =
    (categoryFilter !== "ALL" ? 1 : 0) +
    (labBlockFilter !== "ALL" ? 1 : 0) +
    (stockFilter !== "ALL" ? 1 : 0) +
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
    setStockFilter("ALL");
    setSortBy("name");
  }, []);

  return (
    <div
      className="min-w-0 space-y-4 sm:space-y-6 pb-12"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Clean Editorial Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[34px] font-medium tracking-[-0.03em] text-black leading-tight">
            Campus Inventory
          </h1>
          <p className="mt-1 text-[13.5px] sm:text-[15px] text-black/60 leading-snug">
            Live verified equipment across your campus lab blocks — stock
            quantities update automatically as requests are approved and issued.
          </p>
        </div>

        <Link
          href="/instructor/requests"
          className="inline-flex min-h-[40px] sm:min-h-0 items-center rounded-full border border-black/14 bg-white px-3.5 text-[13.5px] font-medium text-black/80 transition-colors hover:border-black/30 hover:text-black sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:text-[15px] sm:text-black/65"
        >
          Review Student Requests
        </Link>
      </div>

      {/* Compact Stock Telemetry Summary Bar (2x2 mobile, 4-col desktop) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="min-w-0 rounded-[20px] border border-black/14 bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-black/75"
              aria-hidden="true"
            />
            <p className="truncate text-[12.5px] sm:text-[13px] font-medium text-black/55">
              Total Verified Parts
            </p>
          </div>
          <p className="mt-2 text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black tabular-nums leading-none">
            {loading ? "—" : summary.totalParts.toLocaleString()}
          </p>
        </div>

        <div className="min-w-0 rounded-[20px] border border-black/14 bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#C4F041] ring-1 ring-black/25"
              aria-hidden="true"
            />
            <p className="truncate text-[12.5px] sm:text-[13px] font-medium text-black/55">
              Available Units
            </p>
          </div>
          <p className="mt-2 text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black tabular-nums leading-none">
            {loading ? "—" : summary.availableUnits.toLocaleString()}
          </p>
        </div>

        <div className="min-w-0 rounded-[20px] border border-black/14 bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#BCE6FA] ring-1 ring-black/15"
              aria-hidden="true"
            />
            <p className="truncate text-[12.5px] sm:text-[13px] font-medium text-black/55">
              Reserved Units
            </p>
          </div>
          <p className="mt-2 text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black tabular-nums leading-none">
            {loading ? "—" : summary.reservedUnits.toLocaleString()}
          </p>
        </div>

        <div className="min-w-0 rounded-[20px] border border-black/14 bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[#AAC2AA] ring-1 ring-black/15"
              aria-hidden="true"
            />
            <p className="truncate text-[12.5px] sm:text-[13px] font-medium text-black/55">
              Borrowed Units
            </p>
          </div>
          <p className="mt-2 text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black tabular-nums leading-none">
            {loading ? "—" : summary.borrowedUnits.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Mobile-First Filter Bar (collapsible drawer on mobile, inline bar on sm+) */}
      <div className="rounded-[20px] sm:rounded-[22px] border border-black/12 bg-white p-3 sm:p-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        {/* Full-width search bar on top for mobile, flexible pill on sm+ */}
        <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, brand, category, lab block..."
            className="min-h-[44px] h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] pl-10 pr-10 text-[16px] sm:text-[14px] text-black placeholder:text-black/45 focus:border-black focus:bg-white focus:outline-none"
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
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C4F041] px-1.5 text-[12px] font-semibold text-black tabular-nums">
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
                <span className="max-w-[160px] truncate">{labBlockFilter}</span>
                <X className="h-3 w-3 text-black/55" />
              </button>
            )}
            {stockFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setStockFilter("ALL")}
                className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
              >
                <span>{STOCK_STATUS_LABELS[stockFilter]}</span>
                <X className="h-3 w-3 text-black/55" />
              </button>
            )}
            {sortBy !== "name" && (
              <button
                type="button"
                onClick={() => setSortBy("name")}
                className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
              >
                <span>{SORT_LABELS[sortBy]}</span>
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
            className="col-span-2 min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/15 bg-white px-3.5 text-[15px] font-medium text-black focus:border-black focus:outline-none sm:w-auto sm:rounded-full sm:px-4 sm:text-[14px]"
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
            className="min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/15 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none sm:w-auto sm:rounded-full sm:px-4"
          >
            <option value="ALL">All Lab Blocks</option>
            {PROCUREMENT_LAB_BLOCKS.map((block) => (
              <option key={block} value={block}>
                {block}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) =>
              setStockFilter(e.target.value as StockStatusFilter)
            }
            aria-label="Filter by stock status"
            className="min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/15 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none sm:w-auto sm:rounded-full sm:px-4"
          >
            <option value="ALL">All Stock</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort inventory"
            className="col-span-2 min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/15 bg-white px-3.5 text-[14px] font-medium text-black focus:border-black focus:outline-none sm:w-auto sm:rounded-full sm:px-4"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="available">Sort: Most Available</option>
            <option value="borrowed">Sort: Most Borrowed</option>
          </select>
        </div>

        {/* Desktop count + Cards/Sheet view toggle */}
        <div className="hidden sm:flex sm:ml-auto items-center gap-3">
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[13.5px] font-medium text-black/55 hover:text-black transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
          <span className="text-[14px] text-black/55 tabular-nums whitespace-nowrap">
            {filtered.length} parts
          </span>
          <div
            role="group"
            aria-label="View mode"
            className="hidden md:inline-flex items-center rounded-full border border-black/14 bg-[#F7F7F5] p-1"
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                viewMode === "cards"
                  ? "bg-black text-white"
                  : "text-black/65 hover:text-black"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sheet")}
              aria-pressed={viewMode === "sheet"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                viewMode === "sheet"
                  ? "bg-black text-white"
                  : "text-black/65 hover:text-black"
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Catalog: Shimmer Skeletons, Empty State, Visual Cards, or Desktop Stock Sheet */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[18px] sm:rounded-[22px] border border-black/12 bg-white"
            >
              <div className="lp-shimmer aspect-[4/3] w-full" />
              <div className="p-2.5 sm:p-4 space-y-2 sm:space-y-2.5">
                <div className="lp-shimmer h-3.5 sm:h-4 w-20 sm:w-28 rounded-md" />
                <div className="lp-shimmer h-4 sm:h-5 w-4/5 rounded-md" />
                <div className="lp-shimmer h-12 sm:h-14 w-full rounded-[12px] mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-black/12 bg-white py-14 sm:py-16 px-4 text-center space-y-3">
          <p className="text-[15px] sm:text-[16px] text-black/60">
            No verified campus equipment matches your current filters.
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
          {/* Visual WebP Hardware Grid (always active on mobile, default on desktop) */}
          <div
            className={
              viewMode === "sheet"
                ? "grid grid-cols-2 gap-3 sm:gap-5 md:hidden"
                : "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
            }
          >
            {visibleParts.map((row) => (
              <InstructorPartCard key={row.id} row={row} />
            ))}
          </div>

          {/* Desktop Quick Stock Sheet (md+ only when toggled to Sheet) */}
          {viewMode === "sheet" && (
            <div className="hidden md:block overflow-hidden rounded-[22px] border border-black/12 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] sheet-table">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-[13px] font-medium text-black/55">
                      <th className="px-4 py-3.5">Equipment</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Lab Block</th>
                      <th className="px-4 py-3.5 text-right">Available</th>
                      <th className="px-4 py-3.5 text-right">Reserved</th>
                      <th className="px-4 py-3.5 text-right">Borrowed</th>
                      <th className="px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/8">
                    {visibleParts.map((row) => {
                      const meta = extractItemProcurementMeta(
                        row.item.specifications
                      );
                      const stockState = getStockState(row.availableQuantity);
                      const imgSrc =
                        row.item.imageUrl ||
                        getPartImageUrl(row.item.code, row.item.category.slug);

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-[#F7F7F5]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-13 shrink-0 overflow-hidden rounded-[10px] border border-black/10">
                                <ShimmerPartImage
                                  src={imgSrc}
                                  alt={row.item.name}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-black truncate max-w-[280px] lg:max-w-[360px]">
                                  {row.item.name}
                                </p>
                                <p className="text-[12.5px] text-black/50 truncate">
                                  <span className="font-mono">
                                    {row.item.code}
                                  </span>
                                  {row.item.brand ? ` · ${row.item.brand}` : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13.5px] text-black/75">
                            {row.item.category.name}
                          </td>
                          <td className="px-4 py-3 text-[13.5px] text-black/65">
                            {meta.labBlock ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-black tabular-nums">
                            {row.availableQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-black/75 tabular-nums">
                            {row.reservedQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-black/75 tabular-nums">
                            {row.borrowedQuantity}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-black/80 whitespace-nowrap">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  stockState === "OUT_OF_STOCK"
                                    ? "bg-black/25"
                                    : stockState === "LOW_STOCK"
                                      ? "bg-[#F59E0B]"
                                      : "bg-[#C4F041] ring-1 ring-black/25"
                                }`}
                                aria-hidden="true"
                              />
                              {STOCK_STATUS_LABELS[stockState]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progressive Batch Infinite Scroll Sentinel */}
          {visibleCount < filtered.length && (
            <div
              ref={setSentinelEl}
              className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[18px] sm:rounded-[22px] border border-black/12 bg-white"
                >
                  <div className="lp-shimmer aspect-[4/3] w-full" />
                  <div className="p-2.5 sm:p-4 space-y-2 sm:space-y-2.5">
                    <div className="lp-shimmer h-3.5 sm:h-4 w-20 sm:w-28 rounded-md" />
                    <div className="lp-shimmer h-4 sm:h-5 w-4/5 rounded-md" />
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

export default function InstructorInventoryPage() {
  return (
    <SmoothScrollProvider>
      <InstructorInventoryInner />
    </SmoothScrollProvider>
  );
}
