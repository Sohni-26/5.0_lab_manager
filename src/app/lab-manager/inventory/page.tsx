"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Columns3,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  MapPin,
  Minus,
  PackagePlus,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  TableProperties,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import {
  SmoothScrollProvider,
  useLenis,
} from "@/components/landing/smooth-scroll";
import { ShimmerPartImage } from "@/components/student/part-picker-card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import {
  ApiClientError,
  apiClient,
  isBackendUnavailableError,
} from "@/lib/api-client";
import { DEMO_CATEGORIES } from "@/lib/demo-data";
import {
  addDemoCampusStockItem,
  adjustDemoInventoryStock,
  bulkDemoInventoryVisibility,
  loadDemoCampusInventory,
  toggleDemoInventoryVisibility,
} from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import {
  extractItemProcurementMeta,
  formatInr,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import { exportToCsv, formatDateTime } from "@/lib/utils";
import type { CampusInventoryDTO, ItemCategoryDTO } from "@/types/contracts";

const BATCH_SIZE = 24;

const WATCHED_REALTIME_EVENTS = new Set<string>([
  "inventory.updated",
  "inventory.visibility_changed",
  "visibility.changed",
  "allocation.verified",
  "request.status_changed",
  "request.returned",
  "borrowing.issued",
  "return.submitted",
  "return.verified",
]);

type ViewMode = "gallery" | "sheet";
type VisibilityFilter = "ALL" | "VISIBLE" | "HIDDEN";
type StockStatusFilter = "ALL" | "LOW_OUT" | "ATTENTION" | "IN_STOCK";
type AdjustBucket =
  | "availableQuantity"
  | "damagedQuantity"
  | "missingQuantity";

const VISIBILITY_LABELS: Record<VisibilityFilter, string> = {
  ALL: "All Visibility",
  VISIBLE: "Visible",
  HIDDEN: "Hidden",
};

const STOCK_STATUS_LABELS: Record<StockStatusFilter, string> = {
  ALL: "All Stock",
  LOW_OUT: "Low / Out",
  ATTENTION: "Damaged / Missing",
  IN_STOCK: "In Stock",
};

const ADJUST_BUCKET_META: Record<
  AdjustBucket,
  { label: string; shortLabel: string; dotClass: string }
> = {
  availableQuantity: {
    label: "Available Qty",
    shortLabel: "Available",
    dotClass: "bg-[#16A34A]",
  },
  damagedQuantity: {
    label: "Damaged Qty",
    shortLabel: "Damaged",
    dotClass: "bg-[#DC2626]",
  },
  missingQuantity: {
    label: "Missing Qty",
    shortLabel: "Missing",
    dotClass: "bg-[#D97706]",
  },
};

const DELTA_PRESETS = [-5, -1, 1, 5, 10] as const;

function getLabBlock(
  specifications: Record<string, unknown> | null | undefined
): string | null {
  if (!specifications) return null;
  if (
    typeof specifications.lab === "string" &&
    specifications.lab.trim().length > 0
  ) {
    return specifications.lab.trim();
  }
  if (
    typeof specifications.labBlock === "string" &&
    specifications.labBlock.trim().length > 0
  ) {
    return specifications.labBlock.trim();
  }
  return null;
}

function getAvailabilityTone(availableQuantity: number): {
  label: string;
  dotColor: string;
  textColor: string;
  state: "AVAILABLE" | "LOW" | "OUT";
} {
  if (availableQuantity <= 0) {
    return {
      label: "Out",
      dotColor: "#DC2626",
      textColor: "text-[#B91C1C]",
      state: "OUT",
    };
  }
  if (availableQuantity <= 3) {
    return {
      label: "Low",
      dotColor: "#D97706",
      textColor: "text-[#B45309]",
      state: "LOW",
    };
  }
  return {
    label: "Available",
    dotColor: "#16A34A",
    textColor: "text-[#15803D]",
    state: "AVAILABLE",
  };
}

function getStockAttentionCount(row: CampusInventoryDTO): number {
  return row.damagedQuantity + row.missingQuantity;
}

/** Option A Soft Framed Gallery Card for Campus Inventory Control */
const CampusInventoryCard = React.memo(function CampusInventoryCard({
  row,
  isSelected,
  onToggleSelect,
  onToggleVisibility,
  onOpenAdjust,
}: {
  row: CampusInventoryDTO;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleVisibility: (row: CampusInventoryDTO, nextVisible: boolean) => void;
  onOpenAdjust: (row: CampusInventoryDTO) => void;
}) {
  const labBlock = getLabBlock(row.item.specifications);
  const availTone = getAvailabilityTone(row.availableQuantity);
  const attentionCount = getStockAttentionCount(row);
  const imgSrc =
    row.item.imageUrl || getPartImageUrl(row.item.code, row.item.category.slug);

  return (
    <article
      className={`part-card-perf group flex min-w-0 flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-2.5 pb-3.5 transition-[transform,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isSelected
          ? "ring-2 ring-[#C4F041] shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
          : "ring-1 ring-black/[0.045] shadow-[0_8px_28px_rgba(0,0,0,0.045)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]"
      } ${!row.isVisible ? "bg-[#FCFCFA]" : ""}`}
    >
      {/* Inset Photo Mat + Eyebrow & Title */}
      <div className="min-w-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] sm:rounded-[20px] bg-[#F5F5F2]">
          <div className={row.isVisible ? "h-full w-full" : "h-full w-full opacity-75 saturate-[0.7]"}>
            <ShimmerPartImage src={imgSrc} alt={row.item.name} />
          </div>

          {/* Top-left subtle selection checkbox */}
          <button
            type="button"
            onClick={() => onToggleSelect(row.id)}
            aria-label={isSelected ? `Deselect ${row.item.name}` : `Select ${row.item.name}`}
            aria-pressed={isSelected}
            className={`absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
              isSelected
                ? "bg-black text-[#C4F041] shadow-sm ring-1 ring-black"
                : "bg-white/90 text-transparent backdrop-blur-sm ring-1 ring-black/12 shadow-sm hover:bg-white hover:ring-black/30"
            }`}
          >
            <Check className="h-4 w-4 stroke-[2.75]" />
          </button>

          {/* Top-right live availability dot pill */}
          <div
            className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 backdrop-blur-sm ring-1 ring-black/[0.08] shadow-sm"
            title={`Availability: ${availTone.label} (${row.availableQuantity})`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: availTone.dotColor }}
              aria-hidden="true"
            />
            <span className="text-[11.5px] font-semibold text-black/80 tabular-nums leading-none">
              {availTone.label}
            </span>
          </div>

          {/* Subtle bottom-left Hidden badge when unpublished */}
          {!row.isVisible && (
            <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <EyeOff className="h-3 w-3" />
              <span>Hidden</span>
            </div>
          )}
        </div>

        {/* Category & Lab Block Eyebrow + Title */}
        <div className="px-1.5 pt-3 space-y-1">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="text-[12px] font-medium text-[#777771] truncate">
              {row.item.category.name}
              {labBlock ? ` · ${labBlock}` : ""}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-black/50">
              {row.item.code}
            </span>
          </div>

          <h3 className="text-[15.5px] font-semibold tracking-[-0.018em] text-black leading-[1.3] line-clamp-2 min-h-[2.55rem]">
            {row.item.name}
          </h3>
        </div>
      </div>

      {/* Compact Stock Telemetry + Action Footer */}
      <div className="mt-3 px-1.5 space-y-2.5">
        {/* Avail · Borrowed · Reserved telemetry row */}
        <div className="rounded-[16px] bg-[#F5F5F2] px-3 py-2">
          <div className="grid grid-cols-3 divide-x divide-black/[0.07] text-center">
            <div className="pr-1.5 min-w-0">
              <p className="text-[11px] font-medium text-[#777771] truncate">
                Avail
              </p>
              <p
                className={`mt-0.5 text-[14.5px] font-semibold tabular-nums leading-tight ${availTone.textColor}`}
              >
                {row.availableQuantity}
              </p>
            </div>
            <div className="px-1.5 min-w-0">
              <p className="text-[11px] font-medium text-[#777771] truncate">
                Borrowed
              </p>
              <p className="mt-0.5 text-[14.5px] font-semibold text-black tabular-nums leading-tight">
                {row.borrowedQuantity}
              </p>
            </div>
            <div className="pl-1.5 min-w-0">
              <p className="text-[11px] font-medium text-[#777771] truncate">
                Reserved
              </p>
              <p className="mt-0.5 text-[14.5px] font-semibold text-black tabular-nums leading-tight">
                {row.reservedQuantity}
              </p>
            </div>
          </div>

          {attentionCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-black/[0.06] pt-1.5">
              {row.damagedQuantity > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C] tabular-nums">
                  <AlertTriangle className="h-3 w-3" />
                  {row.damagedQuantity} damaged
                </span>
              )}
              {row.missingQuantity > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#B45309] tabular-nums">
                  {row.missingQuantity} missing
                </span>
              )}
            </div>
          )}
        </div>

        {/* Clean Action Footer: Visibility Switch + Adjust Stock */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <label
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3 transition-colors cursor-pointer select-none ${
              row.isVisible
                ? "border-black/10 bg-[#F7F7F4] text-black"
                : "border-black/12 bg-white text-black/60"
            }`}
          >
            <Switch
              checked={row.isVisible}
              onCheckedChange={(checked) => onToggleVisibility(row, checked)}
              aria-label={`Toggle visibility for ${row.item.name}`}
              className="data-[state=checked]:bg-[#16A34A] data-[state=unchecked]:bg-black/20"
            />
            <span className="text-[12.5px] font-medium whitespace-nowrap">
              {row.isVisible ? "Visible" : "Hidden"}
            </span>
          </label>

          <button
            type="button"
            onClick={() => onOpenAdjust(row)}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-black/14 bg-white px-3.5 text-[12.5px] font-semibold text-black transition-colors hover:border-black hover:bg-[#C4F041] cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Adjust Stock</span>
          </button>
        </div>
      </div>
    </article>
  );
});

function LabManagerInventoryInner() {
  const { user, isDemoMode } = useAuth();
  const { lenis } = useLenis();

  const [rows, setRows] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingLocalStore, setUsingLocalStore] = useState(false);
  const [liveFlash, setLiveFlash] = useState(false);

  // View & Filter state
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("ALL");
  const [stockStatusFilter, setStockStatusFilter] =
    useState<StockStatusFilter>("ALL");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Progressive rendering
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // TanStack Table state (rowSelection keyed by CampusInventoryDTO.id, shared across Gallery & Sheet)
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    allocatedQuantity: false,
    receivedQuantity: false,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Adjust Stock Modal state
  const [adjustItem, setAdjustItem] = useState<CampusInventoryDTO | null>(null);
  const [adjustField, setAdjustField] =
    useState<AdjustBucket>("availableQuantity");
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustRemarks, setAdjustRemarks] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Add Campus Stock Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addLabBlock, setAddLabBlock] = useState<string>(
    PROCUREMENT_LAB_BLOCKS[0] ?? "Assembly Arena"
  );
  const [addCustomLabBlock, setAddCustomLabBlock] = useState("");
  const [addBrand, setAddBrand] = useState("");
  const [addUnit, setAddUnit] = useState("pcs");
  const [addQuantity, setAddQuantity] = useState(10);
  const [addVisible, setAddVisible] = useState(true);
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerLiveFlash = useCallback(() => {
    setLiveFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setLiveFlash(false), 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const loadInventory = useCallback(async () => {
    if (isDemoMode) {
      setRows(loadDemoCampusInventory());
      setCategories(DEMO_CATEGORIES);
      setUsingLocalStore(true);
      setLoading(false);
      return;
    }

    try {
      const [invRes, catRes] = await Promise.all([
        apiClient.inventory.list({ pageSize: 250 }),
        apiClient.categories.list(),
      ]);
      setRows(invRes.data);
      setCategories(catRes.data);
      setUsingLocalStore(false);
    } catch {
      setRows(loadDemoCampusInventory());
      setCategories(DEMO_CATEGORIES);
      setUsingLocalStore(true);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // Ensure add modal default category stays valid once categories load
  useEffect(() => {
    if (!addCategoryId && categories.length > 0) {
      setAddCategoryId(categories[0].id);
    }
  }, [addCategoryId, categories]);

  useRealtime({
    enabled: true,
    isDemoMode,
    onEvent: (event) => {
      if (WATCHED_REALTIME_EVENTS.has(event.type)) {
        triggerLiveFlash();
        void loadInventory();
      }
    },
    onReconnect: () => {
      void loadInventory();
    },
  });

  // Extract all unique Lab Blocks dynamically (from specifications.lab + specifications.labBlock + procurement defaults)
  const labBlocks = useMemo(() => {
    const set = new Set<string>(PROCUREMENT_LAB_BLOCKS);
    for (const r of rows) {
      const lb = getLabBlock(r.item.specifications);
      if (lb) set.add(lb);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Summary Telemetry metrics
  const telemetry = useMemo(() => {
    let availableUnits = 0;
    let borrowedUnits = 0;
    let reservedUnits = 0;
    let visibleSkus = 0;
    let hiddenSkus = 0;
    let lowOrOutSkus = 0;
    let damagedUnits = 0;
    let missingUnits = 0;

    for (const r of rows) {
      availableUnits += r.availableQuantity;
      borrowedUnits += r.borrowedQuantity;
      reservedUnits += r.reservedQuantity;
      damagedUnits += r.damagedQuantity;
      missingUnits += r.missingQuantity;
      if (r.isVisible) visibleSkus += 1;
      else hiddenSkus += 1;
      if (r.availableQuantity <= 3) lowOrOutSkus += 1;
    }

    return {
      totalSkus: rows.length,
      visibleSkus,
      availableUnits,
      lowOrOutSkus,
      borrowedUnits,
      reservedUnits,
      inCirculationUnits: borrowedUnits + reservedUnits,
      hiddenSkus,
      damagedUnits,
      missingUnits,
      attentionCount: hiddenSkus + damagedUnits + missingUnits,
    };
  }, [rows]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const labBlock = getLabBlock(r.item.specifications);
      const meta = extractItemProcurementMeta(r.item.specifications);

      if (categoryFilter !== "ALL" && r.item.category.id !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && labBlock !== labBlockFilter) {
        return false;
      }
      if (visibilityFilter === "VISIBLE" && !r.isVisible) return false;
      if (visibilityFilter === "HIDDEN" && r.isVisible) return false;

      if (stockStatusFilter === "LOW_OUT" && r.availableQuantity > 3) {
        return false;
      }
      if (
        stockStatusFilter === "ATTENTION" &&
        r.damagedQuantity <= 0 &&
        r.missingQuantity <= 0
      ) {
        return false;
      }
      if (stockStatusFilter === "IN_STOCK" && r.availableQuantity <= 3) {
        return false;
      }

      if (!q) return true;
      return (
        r.item.name.toLowerCase().includes(q) ||
        r.item.code.toLowerCase().includes(q) ||
        r.item.category.name.toLowerCase().includes(q) ||
        (r.item.brand?.toLowerCase().includes(q) ?? false) ||
        (labBlock?.toLowerCase().includes(q) ?? false) ||
        (meta.vendorActual?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [
    rows,
    search,
    categoryFilter,
    labBlockFilter,
    visibilityFilter,
    stockStatusFilter,
  ]);

  // Reset progressive batch count when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [
    search,
    categoryFilter,
    labBlockFilter,
    visibilityFilter,
    stockStatusFilter,
  ]);

  useEffect(() => {
    const id = requestAnimationFrame(() => lenis?.resize());
    return () => cancelAnimationFrame(id);
  }, [visibleCount, filteredData.length, viewMode, lenis]);

  const visibleGalleryRows = useMemo(
    () => filteredData.slice(0, visibleCount),
    [filteredData, visibleCount]
  );

  // Selection helpers shared between Gallery & Sheet
  const rowsById = useMemo(() => {
    const map = new Map<string, CampusInventoryDTO>();
    for (const r of rows) map.set(r.id, r);
    return map;
  }, [rows]);

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([id, checked]) => checked && rowsById.has(id))
        .map(([id]) => id),
    [rowSelection, rowsById]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setRowSelection((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }, []);

  const handleToggleVisibility = useCallback(
    async (record: CampusInventoryDTO, nextVisible: boolean) => {
      // Optimistic UI update
      setRows((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, isVisible: nextVisible, updatedAt: new Date().toISOString() }
            : r
        )
      );

      if (isDemoMode || usingLocalStore) {
        const updatedList = toggleDemoInventoryVisibility(
          record.id,
          nextVisible,
          user
        );
        setRows(updatedList);
        triggerLiveFlash();
        toast.success(
          `${record.item.code} is now ${
            nextVisible ? "visible to campus" : "hidden from catalog"
          }`
        );
        return;
      }

      try {
        await apiClient.inventory.toggleVisibility(record.id, nextVisible);
        triggerLiveFlash();
        toast.success(
          `${record.item.code} is now ${
            nextVisible ? "visible to instructors & students" : "hidden from catalog"
          }`
        );
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          const updatedList = toggleDemoInventoryVisibility(
            record.id,
            nextVisible,
            user
          );
          setRows(updatedList);
          setUsingLocalStore(true);
          triggerLiveFlash();
          toast.success(
            `${record.item.code} ${
              nextVisible ? "visible" : "hidden"
            } (saved locally)`
          );
        } else {
          // Revert optimistic update
          setRows((prev) =>
            prev.map((r) =>
              r.id === record.id ? { ...r, isVisible: !nextVisible } : r
            )
          );
          toast.error(
            err instanceof Error ? err.message : "Failed to update visibility"
          );
        }
      }
    },
    [isDemoMode, usingLocalStore, user, triggerLiveFlash]
  );

  const handleBulkVisibility = useCallback(
    async (isVisible: boolean) => {
      if (selectedIds.length === 0) return;
      const ids = [...selectedIds];
      const now = new Date().toISOString();

      setRows((prev) =>
        prev.map((r) =>
          ids.includes(r.id) ? { ...r, isVisible, updatedAt: now } : r
        )
      );
      setRowSelection({});

      if (isDemoMode || usingLocalStore) {
        const updatedList = bulkDemoInventoryVisibility(ids, isVisible, user);
        setRows(updatedList);
        triggerLiveFlash();
        toast.success(
          `${ids.length} item${ids.length === 1 ? "" : "s"} ${
            isVisible ? "shown to campus" : "hidden from campus"
          }`
        );
        return;
      }

      try {
        await apiClient.inventory.bulkVisibility(ids, isVisible);
        triggerLiveFlash();
        toast.success(
          `${ids.length} item${ids.length === 1 ? "" : "s"} ${
            isVisible ? "shown to campus" : "hidden from campus"
          }`
        );
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          const updatedList = bulkDemoInventoryVisibility(ids, isVisible, user);
          setRows(updatedList);
          setUsingLocalStore(true);
          triggerLiveFlash();
          toast.success(
            `${ids.length} item${ids.length === 1 ? "" : "s"} updated locally`
          );
        } else {
          void loadInventory();
          toast.error(
            err instanceof Error ? err.message : "Bulk visibility update failed"
          );
        }
      }
    },
    [selectedIds, isDemoMode, usingLocalStore, user, triggerLiveFlash, loadInventory]
  );

  const handleOpenAdjust = useCallback((record: CampusInventoryDTO) => {
    setAdjustItem(record);
    setAdjustField("availableQuantity");
    setAdjustDelta(0);
    setAdjustRemarks("");
  }, []);

  // TanStack Table columns for Sheet View
  const columns = useMemo<ColumnDef<CampusInventoryDTO>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
            aria-label="Select all visible rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
            aria-label={`Select ${row.original.item.name}`}
          />
        ),
      },
      {
        id: "itemName",
        accessorFn: (row) => row.item.name,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-black"
          >
            Equipment <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original.item;
          const meta = extractItemProcurementMeta(item.specifications);
          const imgSrc =
            item.imageUrl || getPartImageUrl(item.code, item.category.slug);
          return (
            <div className="flex items-center gap-3 min-w-[230px]">
              <div className="h-10 w-13 shrink-0 overflow-hidden rounded-[10px] border border-black/10 bg-[#F5F5F2]">
                <ShimmerPartImage src={imgSrc} alt={item.name} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-black truncate max-w-[250px]">
                  {item.name}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-black/55">
                  <span className="font-semibold text-black/70">
                    {item.code}
                  </span>
                  {meta.unitPriceInr !== null && (
                    <span className="tabular-nums">
                      · {formatInr(meta.unitPriceInr)}
                    </span>
                  )}
                  {!row.original.isVerified && (
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                      Unverified
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "category",
        accessorFn: (row) => row.item.category.name,
        header: "Category",
        cell: ({ getValue }) => (
          <span className="inline-flex items-center rounded-full bg-[#F5F5F2] px-2.5 py-0.5 text-[12px] font-medium text-black/75 whitespace-nowrap">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: "labBlock",
        accessorFn: (row) => getLabBlock(row.item.specifications) ?? "—",
        header: "Lab Block",
        cell: ({ getValue }) => {
          const val = String(getValue());
          return val !== "—" ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-black/70 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-black/40 shrink-0" />
              {val}
            </span>
          ) : (
            <span className="text-xs text-black/35">—</span>
          );
        },
      },
      {
        accessorKey: "allocatedQuantity",
        header: () => <div className="text-right">Allocated</div>,
        cell: ({ getValue }) => (
          <div className="text-right text-xs tabular-nums text-black/75">
            {Number(getValue())}
          </div>
        ),
      },
      {
        accessorKey: "receivedQuantity",
        header: () => <div className="text-right">Received</div>,
        cell: ({ getValue }) => (
          <div className="text-right text-xs tabular-nums text-black/75">
            {Number(getValue())}
          </div>
        ),
      },
      {
        accessorKey: "availableQuantity",
        header: ({ column }) => (
          <div className="text-right">
            <button
              type="button"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="inline-flex items-center gap-1 cursor-pointer hover:text-black"
            >
              Avail <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        ),
        cell: ({ getValue }) => {
          const val = Number(getValue());
          const tone = getAvailabilityTone(val);
          return (
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F2] px-2.5 py-0.5 text-xs font-bold tabular-nums text-black">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tone.dotColor }}
                />
                {val}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "borrowedQuantity",
        header: ({ column }) => (
          <div className="text-right">
            <button
              type="button"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="inline-flex items-center gap-1 cursor-pointer hover:text-black"
            >
              Borrowed <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        ),
        cell: ({ getValue }) => (
          <div className="text-right text-xs font-semibold tabular-nums text-black/80">
            {Number(getValue())}
          </div>
        ),
      },
      {
        accessorKey: "reservedQuantity",
        header: () => <div className="text-right">Reserved</div>,
        cell: ({ getValue }) => (
          <div className="text-right text-xs font-semibold tabular-nums text-black/75">
            {Number(getValue())}
          </div>
        ),
      },
      {
        id: "damagedMissing",
        accessorFn: (row) => row.damagedQuantity + row.missingQuantity,
        header: () => <div className="text-right">Dmg / Miss</div>,
        cell: ({ row }) => {
          const dmg = row.original.damagedQuantity;
          const miss = row.original.missingQuantity;
          if (dmg === 0 && miss === 0) {
            return (
              <div className="text-right text-xs tabular-nums text-black/35">
                0
              </div>
            );
          }
          return (
            <div className="flex items-center justify-end gap-1">
              {dmg > 0 && (
                <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C] tabular-nums">
                  {dmg}D
                </span>
              )}
              {miss > 0 && (
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#B45309] tabular-nums">
                  {miss}M
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "visibility",
        accessorKey: "isVisible",
        header: "Visibility",
        cell: ({ row }) => (
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={row.original.isVisible}
              onCheckedChange={(v) => handleToggleVisibility(row.original, v)}
              className="data-[state=checked]:bg-[#16A34A] data-[state=unchecked]:bg-black/20"
            />
            <span className="text-[12px] font-medium text-black/65">
              {row.original.isVisible ? "Visible" : "Hidden"}
            </span>
          </label>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-xs text-black/50 whitespace-nowrap tabular-nums">
            {formatDateTime(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Adjust</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <button
              type="button"
              onClick={() => handleOpenAdjust(row.original)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/14 bg-white px-3 text-[12px] font-semibold text-black transition-colors hover:border-black hover:bg-[#C4F041] cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Adjust</span>
            </button>
          </div>
        ),
      },
    ],
    [handleToggleVisibility, handleOpenAdjust]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleSheetRows = useMemo(
    () => table.getRowModel().rows.slice(0, visibleCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, filteredData, sorting, visibleCount, rowSelection, columnVisibility]
  );

  // Filter badge count & reset
  const activeFilterCount =
    (categoryFilter !== "ALL" ? 1 : 0) +
    (labBlockFilter !== "ALL" ? 1 : 0) +
    (visibilityFilter !== "ALL" ? 1 : 0) +
    (stockStatusFilter !== "ALL" ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || search.trim().length > 0;

  const activeCategoryName = useMemo(
    () => categories.find((c) => c.id === categoryFilter)?.name ?? null,
    [categories, categoryFilter]
  );

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setCategoryFilter("ALL");
    setLabBlockFilter("ALL");
    setVisibilityFilter("ALL");
    setStockStatusFilter("ALL");
  }, []);

  // CSV Export
  const handleExportCsv = useCallback(() => {
    exportToCsv(
      `campus-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredData.map((r) => {
        const meta = extractItemProcurementMeta(r.item.specifications);
        const labBlock = getLabBlock(r.item.specifications);
        return {
          ItemCode: r.item.code,
          ItemName: r.item.name,
          Category: r.item.category.name,
          LabBlock: labBlock ?? "",
          Brand: r.item.brand ?? "",
          Vendor: meta.vendorActual ?? "",
          UnitPriceINR: meta.unitPriceInr ?? "",
          Allocated: r.allocatedQuantity,
          Received: r.receivedQuantity,
          Available: r.availableQuantity,
          Reserved: r.reservedQuantity,
          Borrowed: r.borrowedQuantity,
          Damaged: r.damagedQuantity,
          Missing: r.missingQuantity,
          Visible: r.isVisible ? "Yes" : "No",
          LastUpdated: r.updatedAt,
        };
      })
    );
    toast.success(`Exported ${filteredData.length} campus inventory SKUs to CSV`);
  }, [filteredData]);

  // Adjust Stock submission
  const adjustCurrentValue = adjustItem ? adjustItem[adjustField] : 0;
  const adjustPreviewAfter = Math.max(0, adjustCurrentValue + adjustDelta);
  const adjustEffectiveDelta = adjustPreviewAfter - adjustCurrentValue;

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    if (adjustDelta === 0) {
      toast.error("Adjustment delta cannot be 0");
      return;
    }
    if (adjustRemarks.trim().length < 3) {
      toast.error("Mandatory audit remarks (min 3 characters) required");
      return;
    }

    setAdjustSaving(true);
    const payload = {
      field: adjustField,
      delta: adjustDelta,
      remarks: adjustRemarks.trim(),
    };

    try {
      if (isDemoMode || usingLocalStore) {
        const updatedList = adjustDemoInventoryStock(adjustItem.id, payload, user);
        setRows(updatedList);
        triggerLiveFlash();
        toast.success(
          `Adjusted ${adjustItem.item.code} (${ADJUST_BUCKET_META[adjustField].shortLabel}: ${adjustCurrentValue} → ${adjustPreviewAfter}) and logged to ledger`
        );
        setAdjustItem(null);
        return;
      }

      const res = await apiClient.inventory.adjust(adjustItem.id, payload);
      setRows((prev) =>
        prev.map((r) => (r.id === adjustItem.id ? res.data : r))
      );
      triggerLiveFlash();
      toast.success(`Adjusted ${adjustItem.item.code} and logged transaction`);
      setAdjustItem(null);
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const updatedList = adjustDemoInventoryStock(adjustItem.id, payload, user);
        setRows(updatedList);
        setUsingLocalStore(true);
        triggerLiveFlash();
        toast.success(
          `Adjusted ${adjustItem.item.code} locally and logged to ledger`
        );
        setAdjustItem(null);
      } else {
        toast.error(err instanceof Error ? err.message : "Adjustment failed");
      }
    } finally {
      setAdjustSaving(false);
    }
  };

  // Add Campus Stock submission
  const resetAddForm = useCallback(() => {
    setAddName("");
    setAddCode("");
    setAddCategoryId(categories[0]?.id ?? DEMO_CATEGORIES[0].id);
    setAddLabBlock(labBlocks[0] ?? "Assembly Arena");
    setAddCustomLabBlock("");
    setAddBrand("");
    setAddUnit("pcs");
    setAddQuantity(10);
    setAddVisible(true);
    setAddNotes("");
  }, [categories, labBlocks]);

  const handleOpenAddModal = useCallback(() => {
    resetAddForm();
    setAddModalOpen(true);
  }, [resetAddForm]);

  const handleSubmitAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = addName.trim();
    const trimmedCode = addCode.trim().toUpperCase();
    const resolvedLabBlock =
      addLabBlock === "__CUSTOM__"
        ? addCustomLabBlock.trim() || "General Lab"
        : addLabBlock;

    if (trimmedName.length < 2) {
      toast.error("Please enter a valid part name");
      return;
    }
    if (trimmedCode.length < 2) {
      toast.error("Please enter an item code (e.g. CMP-170)");
      return;
    }

    setAddSaving(true);
    const localInput = {
      name: trimmedName,
      code: trimmedCode,
      categoryId: addCategoryId || categories[0]?.id || DEMO_CATEGORIES[0].id,
      labBlock: resolvedLabBlock,
      brand: addBrand.trim() || undefined,
      unit: addUnit.trim() || "pcs",
      quantity: Math.max(0, addQuantity),
      isVisible: addVisible,
      notes: addNotes.trim() || undefined,
    };

    try {
      if (isDemoMode || usingLocalStore) {
        const updated = addDemoCampusStockItem(localInput, user);
        setRows(updated);
        triggerLiveFlash();
        toast.success(
          `Registered ${trimmedName} (${trimmedCode}) with ${localInput.quantity} ${localInput.unit}`
        );
        setAddModalOpen(false);
        return;
      }

      await apiClient.items.create({
        code: localInput.code,
        name: localInput.name,
        categoryId: localInput.categoryId,
        brand: localInput.brand,
        unit: localInput.unit,
        description: localInput.notes,
        specifications: {
          lab: localInput.labBlock,
          labBlock: localInput.labBlock,
          initialCampusQty: localInput.quantity,
        },
        isActive: true,
      });
      await loadInventory();
      triggerLiveFlash();
      toast.success(
        `Created ${trimmedName} (${trimmedCode}) in master catalog`
      );
      setAddModalOpen(false);
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const updated = addDemoCampusStockItem(localInput, user);
        setRows(updated);
        setUsingLocalStore(true);
        triggerLiveFlash();
        toast.success(
          `Registered ${trimmedName} (${trimmedCode}) in campus stock`
        );
        setAddModalOpen(false);
      } else if (err instanceof ApiClientError && err.status === 403) {
        const updated = addDemoCampusStockItem(localInput, user);
        setRows((prev) => {
          const added = updated[0];
          return added ? [added, ...prev] : prev;
        });
        toast.info(
          "Central catalog creation requires Central Lab Manager — added to local campus stock tracker."
        );
        setAddModalOpen(false);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to register campus part"
        );
      }
    } finally {
      setAddSaving(false);
    }
  };

  const remainingCount = Math.max(0, filteredData.length - visibleCount);

  return (
    <DottedGridCanvas
      pannable={false}
      className="min-w-0 p-3.5 pb-28 sm:p-6 sm:pb-24"
    >
      <div
        className="mx-auto min-w-0 max-w-[1440px] space-y-4 sm:space-y-6"
        style={{
          fontFamily:
            "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Editorial Control Center Header */}
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] sm:text-[34px] font-medium tracking-[-0.03em] text-black leading-tight">
                Campus Inventory
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors duration-200 ${
                  liveFlash
                    ? "bg-[#C4F041] text-black ring-1 ring-black/15"
                    : "bg-white text-black/70 ring-1 ring-black/[0.08] shadow-xs"
                }`}
              >
                <Radio
                  className={`h-3 w-3 ${
                    liveFlash
                      ? "text-black animate-ping"
                      : "text-[#16A34A] animate-pulse"
                  }`}
                />
                <span>{liveFlash ? "Synced just now" : "Live Sync"}</span>
              </span>
            </div>
            <p className="mt-1 text-[13.5px] sm:text-[15px] text-black/60 leading-snug">
              Control every SKU across your campus lab blocks — toggle student
              visibility, adjust stock with audit trails, or register new campus
              equipment.
            </p>
          </div>

          {/* Primary Actions: CSV Export + Add Campus Stock */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex min-h-[42px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-full border border-black/14 bg-white px-4 text-[13.5px] font-medium text-black shadow-xs transition-colors hover:border-black/35 hover:bg-[#F7F7F5] cursor-pointer whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex min-h-[42px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-full bg-[#C4F041] px-4.5 text-[13.5px] font-semibold text-black ring-1 ring-black/12 shadow-[0_6px_18px_rgba(196,240,65,0.35)] transition-all hover:bg-[#B8E635] active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Campus Stock</span>
            </button>
          </div>
        </div>

        {/* Summary Telemetry Bar (4 Soft Cards) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="min-w-0 rounded-[24px] bg-white px-4 py-3.5 sm:px-5 sm:py-4 ring-1 ring-black/[0.045] shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-black/80"
                aria-hidden="true"
              />
              <p className="truncate text-[12px] sm:text-[13px] font-medium text-[#777771]">
                Total SKUs
              </p>
            </div>
            <p className="mt-2 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
              {loading ? "—" : telemetry.totalSkus.toLocaleString()}
            </p>
            <p className="mt-1.5 truncate text-[11.5px] text-black/50 tabular-nums">
              {loading ? "Loading..." : `${telemetry.visibleSkus} visible to campus`}
            </p>
          </div>

          <div className="min-w-0 rounded-[24px] bg-white px-4 py-3.5 sm:px-5 sm:py-4 ring-1 ring-black/[0.045] shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#16A34A]"
                aria-hidden="true"
              />
              <p className="truncate text-[12px] sm:text-[13px] font-medium text-[#777771]">
                Available Units
              </p>
            </div>
            <p className="mt-2 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
              {loading ? "—" : telemetry.availableUnits.toLocaleString()}
            </p>
            <p className="mt-1.5 truncate text-[11.5px] text-black/50 tabular-nums">
              {loading
                ? "Loading..."
                : `${telemetry.lowOrOutSkus} SKU${telemetry.lowOrOutSkus === 1 ? "" : "s"} low or out`}
            </p>
          </div>

          <div className="min-w-0 rounded-[24px] bg-white px-4 py-3.5 sm:px-5 sm:py-4 ring-1 ring-black/[0.045] shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#3B82F6]"
                aria-hidden="true"
              />
              <p className="truncate text-[12px] sm:text-[13px] font-medium text-[#777771]">
                Borrowed / Reserved
              </p>
            </div>
            <p className="mt-2 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
              {loading ? "—" : telemetry.inCirculationUnits.toLocaleString()}
            </p>
            <p className="mt-1.5 truncate text-[11.5px] text-black/50 tabular-nums">
              {loading
                ? "Loading..."
                : `${telemetry.borrowedUnits} borrowed · ${telemetry.reservedUnits} reserved`}
            </p>
          </div>

          <div className="min-w-0 rounded-[24px] bg-white px-4 py-3.5 sm:px-5 sm:py-4 ring-1 ring-black/[0.045] shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  telemetry.damagedUnits + telemetry.missingUnits > 0
                    ? "bg-[#DC2626]"
                    : "bg-[#D97706]"
                }`}
                aria-hidden="true"
              />
              <p className="truncate text-[12px] sm:text-[13px] font-medium text-[#777771]">
                Hidden / Attention
              </p>
            </div>
            <p className="mt-2 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
              {loading ? "—" : telemetry.attentionCount.toLocaleString()}
            </p>
            <p className="mt-1.5 truncate text-[11.5px] text-black/50 tabular-nums">
              {loading
                ? "Loading..."
                : `${telemetry.hiddenSkus} hidden · ${telemetry.damagedUnits + telemetry.missingUnits} dmg/miss`}
            </p>
          </div>
        </div>

        {/* Smart Filter Bar (Collapsible Drawer on < md, Inline Bar on md+) */}
        <div className="rounded-[24px] sm:rounded-[28px] bg-white ring-1 ring-black/[0.045] shadow-[0_6px_24px_rgba(0,0,0,0.04)] p-3 sm:p-4 md:flex md:flex-wrap md:items-center md:gap-2.5">
          {/* Search Input */}
          <div className="relative w-full md:flex-1 md:min-w-[220px] md:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part name, SKU code, brand, lab..."
              className="min-h-[44px] h-11 w-full rounded-full border border-transparent bg-[#F5F5F2] pl-10 pr-10 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 transition-colors focus:border-black/20 focus:bg-white focus:outline-none"
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

          {/* Mobile (< md) compact filter toggle row */}
          <div className="mt-2.5 flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                aria-expanded={mobileFiltersOpen}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors cursor-pointer ${
                  mobileFiltersOpen || activeFilterCount > 0
                    ? "border-black bg-black text-white"
                    : "border-black/14 bg-[#F7F7F5] text-black"
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
                  className="inline-flex min-h-[42px] items-center px-2 text-[13px] font-medium text-black/60 hover:text-black cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-[13px] font-medium text-black/55 tabular-nums whitespace-nowrap">
              {filteredData.length} SKU{filteredData.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Active filter summary pills when collapsed on mobile (< md) */}
          {!mobileFiltersOpen && activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
              {activeCategoryName && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ALL")}
                  className="inline-flex items-center gap-1 rounded-full border border-black/14 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
                >
                  <span className="max-w-[150px] truncate">
                    {activeCategoryName}
                  </span>
                  <X className="h-3 w-3 text-black/55" />
                </button>
              )}
              {labBlockFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setLabBlockFilter("ALL")}
                  className="inline-flex items-center gap-1 rounded-full border border-black/14 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
                >
                  <span className="max-w-[150px] truncate">{labBlockFilter}</span>
                  <X className="h-3 w-3 text-black/55" />
                </button>
              )}
              {visibilityFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setVisibilityFilter("ALL")}
                  className="inline-flex items-center gap-1 rounded-full border border-black/14 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
                >
                  <span>{VISIBILITY_LABELS[visibilityFilter]}</span>
                  <X className="h-3 w-3 text-black/55" />
                </button>
              )}
              {stockStatusFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setStockStatusFilter("ALL")}
                  className="inline-flex items-center gap-1 rounded-full border border-black/14 bg-[#F7F7F5] px-2.5 py-1 text-[12px] font-medium text-black cursor-pointer"
                >
                  <span>{STOCK_STATUS_LABELS[stockStatusFilter]}</span>
                  <X className="h-3 w-3 text-black/55" />
                </button>
              )}
            </div>
          )}

          {/* Filter Dropdowns */}
          <div
            className={`${
              mobileFiltersOpen ? "mt-2.5 grid grid-cols-2 gap-2" : "hidden"
            } md:mt-0 md:contents`}
          >
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="col-span-2 min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[14px] font-medium text-black focus:border-black focus:outline-none md:h-10 md:min-h-[40px] md:w-auto md:max-w-[190px] md:rounded-full md:px-3.5 md:text-[13.5px]"
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
              className="col-span-2 min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[14px] font-medium text-black focus:border-black focus:outline-none md:h-10 md:min-h-[40px] md:w-auto md:max-w-[195px] md:rounded-full md:px-3.5 md:text-[13.5px]"
            >
              <option value="ALL">All Lab Blocks</option>
              {labBlocks.map((block) => (
                <option key={block} value={block}>
                  {block}
                </option>
              ))}
            </select>

            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(e.target.value as VisibilityFilter)
              }
              aria-label="Filter by visibility"
              className="min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none md:h-10 md:min-h-[40px] md:w-auto md:rounded-full md:px-3.5 md:text-[13.5px]"
            >
              <option value="ALL">All Visibility</option>
              <option value="VISIBLE">Visible</option>
              <option value="HIDDEN">Hidden</option>
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) =>
                setStockStatusFilter(e.target.value as StockStatusFilter)
              }
              aria-label="Filter by stock status"
              className="min-w-0 min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none md:h-10 md:min-h-[40px] md:w-auto md:rounded-full md:px-3.5 md:text-[13.5px]"
            >
              <option value="ALL">All Stock</option>
              <option value="LOW_OUT">Low / Out</option>
              <option value="ATTENTION">Has Damaged / Missing</option>
              <option value="IN_STOCK">In Stock (4+)</option>
            </select>
          </div>

          {/* Desktop Right Cluster: Reset + Count + Columns (in Sheet mode) + Gallery|Sheet Switcher */}
          <div className="hidden md:flex md:ml-auto items-center gap-2.5">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[13px] font-medium text-black/55 hover:text-black transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}

            <span className="text-[13.5px] font-medium text-black/55 tabular-nums whitespace-nowrap">
              {filteredData.length} SKU{filteredData.length === 1 ? "" : "s"}
            </span>

            {viewMode === "sheet" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/14 bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:border-black/30 cursor-pointer"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    <span>Columns</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((col) => col.getCanHide())
                    .map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(v) => col.toggleVisibility(Boolean(v))}
                      >
                        {col.id
                          .replace(/Quantity$/, "")
                          .replace(/([A-Z])/g, " $1")
                          .trim()}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div
              role="group"
              aria-label="View mode"
              className="inline-flex items-center rounded-full border border-black/12 bg-[#F5F5F2] p-1"
            >
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                aria-pressed={viewMode === "gallery"}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  viewMode === "gallery"
                    ? "bg-black text-white shadow-xs"
                    : "text-black/65 hover:text-black"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("sheet")}
                aria-pressed={viewMode === "sheet"}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  viewMode === "sheet"
                    ? "bg-black text-white shadow-xs"
                    : "text-black/65 hover:text-black"
                }`}
              >
                <TableProperties className="h-3.5 w-3.5" />
                <span>Sheet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area: Skeleton, Empty State, Soft Framed Gallery, or Desktop TanStack Sheet */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[24px] sm:rounded-[28px] bg-white p-2.5 pb-3.5 ring-1 ring-black/[0.045] shadow-[0_8px_28px_rgba(0,0,0,0.045)]"
              >
                <div className="lp-shimmer aspect-[4/3] w-full rounded-[18px] sm:rounded-[20px]" />
                <div className="px-1.5 pt-3 space-y-2.5">
                  <div className="lp-shimmer h-3.5 w-28 rounded-md" />
                  <div className="lp-shimmer h-4 w-4/5 rounded-md" />
                  <div className="lp-shimmer h-12 w-full rounded-[14px]" />
                  <div className="flex justify-between gap-2 pt-1">
                    <div className="lp-shimmer h-10 w-24 rounded-full" />
                    <div className="lp-shimmer h-10 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="rounded-[24px] sm:rounded-[28px] bg-white ring-1 ring-black/[0.045] shadow-[0_8px_28px_rgba(0,0,0,0.045)] py-14 sm:py-16 px-4 text-center space-y-3">
            <p className="text-[15.5px] font-medium text-black/70">
              No campus inventory items match your current filters.
            </p>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-black/18 bg-white px-5 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Option A Soft Framed Gallery Cards (always on mobile < md, default on desktop) */}
            <div
              className={
                viewMode === "sheet"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:hidden"
                  : "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
              }
            >
              {visibleGalleryRows.map((row) => (
                <CampusInventoryCard
                  key={row.id}
                  row={row}
                  isSelected={Boolean(rowSelection[row.id])}
                  onToggleSelect={handleToggleSelect}
                  onToggleVisibility={handleToggleVisibility}
                  onOpenAdjust={handleOpenAdjust}
                />
              ))}
            </div>

            {/* Modernized TanStack Table Sheet View (md+ when toggled to Sheet) */}
            {viewMode === "sheet" && (
              <div className="hidden md:block overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.045] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px] sheet-table">
                    <thead>
                      {table.getHeaderGroups().map((hg) => (
                        <tr
                          key={hg.id}
                          className="border-b border-black/[0.08] bg-[#FAF9F6] text-left text-[12.5px] font-semibold text-black/55"
                        >
                          {hg.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-3.5 py-3.5 whitespace-nowrap"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                      {visibleSheetRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`transition-colors duration-150 ${
                            row.getIsSelected()
                              ? "bg-[#C4F041]/18"
                              : "hover:bg-[#F7F7F4]"
                          }`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-3.5 py-3">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Progressive Batch Rendering Footer ("Load More" 24 at a time) */}
            {remainingCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(filteredData.length, prev + BATCH_SIZE)
                    )
                  }
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-[14px] font-semibold text-black shadow-xs transition-all hover:border-black hover:bg-[#C4F041] cursor-pointer"
                >
                  <span>
                    Load {Math.min(BATCH_SIZE, remainingCount)} More
                  </span>
                  <span className="rounded-full bg-black/8 px-2 py-0.5 text-[12px] font-medium tabular-nums">
                    {remainingCount} left
                  </span>
                </button>

                {remainingCount > BATCH_SIZE && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filteredData.length)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full px-4 text-[13px] font-medium text-black/60 hover:text-black transition-colors cursor-pointer"
                  >
                    Show all {filteredData.length}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Selection Floating Dock */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk inventory actions"
          className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-fit -translate-x-1/2 rounded-[22px] sm:rounded-full bg-[#141413] px-3 py-2.5 sm:px-4 sm:py-2 text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)] ring-1 ring-white/15"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C4F041] px-2.5 py-1 text-[12.5px] font-semibold text-black tabular-nums whitespace-nowrap">
              {selectedIds.length} selected
            </span>

            <button
              type="button"
              onClick={() => handleBulkVisibility(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white/12 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/22 cursor-pointer whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5 text-[#C4F041]" />
              <span>Show to Campus</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkVisibility(false)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white/12 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/22 cursor-pointer whitespace-nowrap"
            >
              <EyeOff className="h-3.5 w-3.5 text-white/80" />
              <span>Hide from Campus</span>
            </button>

            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Dialog
        open={Boolean(adjustItem)}
        onOpenChange={(open) => !open && setAdjustItem(null)}
      >
        <DialogContent className="rounded-[24px] sm:rounded-[28px] border-black/10 p-5 sm:p-6">
          {adjustItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[12px] border border-black/10 bg-[#F5F5F2]">
                    <ShimmerPartImage
                      src={
                        adjustItem.item.imageUrl ||
                        getPartImageUrl(
                          adjustItem.item.code,
                          adjustItem.item.category.slug
                        )
                      }
                      alt={adjustItem.item.name}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-black/55">
                      {adjustItem.item.code} · {adjustItem.item.category.name}
                    </p>
                    <DialogTitle className="mt-0.5 text-[17px] leading-snug line-clamp-2">
                      {adjustItem.item.name}
                    </DialogTitle>
                  </div>
                </div>
                <DialogDescription className="pt-1 text-[13px] text-black/60">
                  Every stock adjustment writes an immutable audit entry to your
                  campus transaction ledger and broadcasts live updates.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmitAdjustment} className="space-y-4">
                {/* Bucket Selector Pills */}
                <div className="space-y-1.5">
                  <p className="text-[12.5px] font-semibold text-black/75">
                    Stock Bucket
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        "availableQuantity",
                        "damagedQuantity",
                        "missingQuantity",
                      ] as const
                    ).map((bucket) => {
                      const active = adjustField === bucket;
                      const meta = ADJUST_BUCKET_META[bucket];
                      return (
                        <button
                          key={bucket}
                          type="button"
                          onClick={() => {
                            setAdjustField(bucket);
                            setAdjustDelta(0);
                          }}
                          className={`flex min-h-[58px] flex-col items-center justify-center rounded-[16px] border px-2 py-2 transition-all cursor-pointer ${
                            active
                              ? "border-black bg-black text-white shadow-sm"
                              : "border-black/10 bg-[#F5F5F2] text-black hover:border-black/25"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium opacity-85">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                            />
                            {meta.shortLabel}
                          </span>
                          <span className="mt-0.5 text-[16px] font-bold tabular-nums">
                            {adjustItem[bucket]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Big 44px Delta Stepper + Quick Presets */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="adj-delta-input"
                      className="text-[12.5px] font-semibold text-black/75"
                    >
                      Quantity Delta (+/-)
                    </label>
                    {adjustDelta !== 0 && (
                      <button
                        type="button"
                        onClick={() => setAdjustDelta(0)}
                        className="text-[12px] font-medium text-black/55 hover:text-black cursor-pointer"
                      >
                        Reset to 0
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustDelta((d) => d - 1)}
                      aria-label="Decrease delta by 1"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black transition-colors hover:border-black hover:bg-[#F5F5F2] active:scale-95 cursor-pointer"
                    >
                      <Minus className="h-4.5 w-4.5" />
                    </button>

                    <input
                      id="adj-delta-input"
                      type="number"
                      value={adjustDelta}
                      onChange={(e) =>
                        setAdjustDelta(
                          Number.isNaN(Number(e.target.value))
                            ? 0
                            : Math.trunc(Number(e.target.value))
                        )
                      }
                      className="h-11 min-w-0 flex-1 rounded-full border border-black/15 bg-[#F5F5F2] px-4 text-center text-[16px] font-bold text-black tabular-nums focus:border-black focus:bg-white focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => setAdjustDelta((d) => d + 1)}
                      aria-label="Increase delta by 1"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black transition-colors hover:border-black hover:bg-[#C4F041] active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {/* Quick Delta Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DELTA_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdjustDelta((d) => d + preset)}
                        className="inline-flex min-h-[34px] flex-1 items-center justify-center rounded-full border border-black/12 bg-white px-2.5 text-[12.5px] font-semibold text-black tabular-nums transition-colors hover:border-black hover:bg-[#F5F5F2] cursor-pointer"
                      >
                        {preset > 0 ? `+${preset}` : preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Before → After Preview */}
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F5F5F2] px-4 py-3 ring-1 ring-black/[0.06]">
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium text-[#777771]">
                      Live Preview ({ADJUST_BUCKET_META[adjustField].shortLabel})
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[18px] font-bold tabular-nums text-black">
                      <span>{adjustCurrentValue}</span>
                      <ArrowRight className="h-4 w-4 text-black/45" />
                      <span
                        className={
                          adjustEffectiveDelta > 0
                            ? "text-[#15803D]"
                            : adjustEffectiveDelta < 0
                              ? "text-[#B91C1C]"
                              : "text-black"
                        }
                      >
                        {adjustPreviewAfter}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold tabular-nums ${
                      adjustEffectiveDelta > 0
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : adjustEffectiveDelta < 0
                          ? "bg-[#FEE2E2] text-[#B91C1C]"
                          : "bg-black/8 text-black/55"
                    }`}
                  >
                    {adjustEffectiveDelta > 0
                      ? `+${adjustEffectiveDelta}`
                      : adjustEffectiveDelta}
                  </span>
                </div>

                {/* Mandatory Audit Remarks */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="adj-remarks"
                    className="text-[12.5px] font-semibold text-black/75"
                  >
                    Mandatory Audit Remarks *
                  </label>
                  <textarea
                    id="adj-remarks"
                    rows={3}
                    required
                    value={adjustRemarks}
                    onChange={(e) => setAdjustRemarks(e.target.value)}
                    placeholder="e.g. Verified shelf count after lab session, or repaired unit returned to service"
                    className="w-full rounded-[16px] border border-black/14 bg-white px-3.5 py-2.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                  />
                </div>

                <DialogFooter className="gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAdjustItem(null)}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13.5px] font-medium text-black hover:bg-[#F5F5F2] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustSaving || adjustDelta === 0}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#C4F041] px-5 text-[13.5px] font-semibold text-black ring-1 ring-black/12 transition-colors hover:bg-[#B8E635] disabled:opacity-45 cursor-pointer"
                  >
                    {adjustSaving ? "Saving..." : "Apply Adjustment"}
                  </button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* + Add Campus Stock Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="rounded-[24px] sm:rounded-[28px] border-black/10 p-5 sm:p-6">
          <DialogHeader>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C4F041] text-black ring-1 ring-black/10 mb-1">
              <PackagePlus className="h-5 w-5" />
            </div>
            <DialogTitle className="text-[19px] tracking-[-0.02em]">
              Add Campus Stock
            </DialogTitle>
            <DialogDescription className="text-[13.5px] text-black/60">
              Register a new equipment SKU directly into your campus lab
              inventory and audit ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAddStock} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="add-part-name"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Part Name *
                </label>
                <input
                  id="add-part-name"
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Raspberry Pi 5 (8GB)"
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-part-code"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Item Code *
                </label>
                <input
                  id="add-part-code"
                  type="text"
                  required
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                  placeholder="DEV-170"
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[16px] sm:text-[14px] font-semibold uppercase text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-category"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Category *
                </label>
                <select
                  id="add-category"
                  value={addCategoryId}
                  onChange={(e) => setAddCategoryId(e.target.value)}
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-lab-block"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Lab Block *
                </label>
                <select
                  id="add-lab-block"
                  value={addLabBlock}
                  onChange={(e) => setAddLabBlock(e.target.value)}
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3 text-[14px] font-medium text-black focus:border-black focus:outline-none"
                >
                  {labBlocks.map((block) => (
                    <option key={block} value={block}>
                      {block}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Custom Lab Block</option>
                </select>
              </div>
            </div>

            {addLabBlock === "__CUSTOM__" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="add-custom-lab"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Custom Lab Block Name
                </label>
                <input
                  id="add-custom-lab"
                  type="text"
                  value={addCustomLabBlock}
                  onChange={(e) => setAddCustomLabBlock(e.target.value)}
                  placeholder="e.g. Robotics Bay B"
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-brand"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Brand / Make
                </label>
                <input
                  id="add-brand"
                  type="text"
                  value={addBrand}
                  onChange={(e) => setAddBrand(e.target.value)}
                  placeholder="e.g. Raspberry Pi"
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-unit"
                  className="text-[12.5px] font-semibold text-black/75"
                >
                  Unit
                </label>
                <input
                  id="add-unit"
                  type="text"
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value)}
                  placeholder="pcs / kit / spool"
                  className="min-h-[44px] h-11 w-full rounded-[14px] border border-black/14 bg-white px-3.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
                />
              </div>
            </div>

            {/* Initial Quantity Stepper */}
            <div className="space-y-2">
              <label
                htmlFor="add-qty"
                className="text-[12.5px] font-semibold text-black/75"
              >
                Initial Campus Quantity
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddQuantity((q) => Math.max(0, q - 1))}
                  aria-label="Decrease initial quantity"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black transition-colors hover:border-black hover:bg-[#F5F5F2] cursor-pointer"
                >
                  <Minus className="h-4.5 w-4.5" />
                </button>
                <input
                  id="add-qty"
                  type="number"
                  min={0}
                  value={addQuantity}
                  onChange={(e) =>
                    setAddQuantity(
                      Math.max(0, Math.trunc(Number(e.target.value) || 0))
                    )
                  }
                  className="h-11 min-w-0 flex-1 rounded-full border border-black/15 bg-[#F5F5F2] px-4 text-center text-[16px] font-bold text-black tabular-nums focus:border-black focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAddQuantity((q) => q + 1)}
                  aria-label="Increase initial quantity"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black transition-colors hover:border-black hover:bg-[#C4F041] cursor-pointer"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {[5, 10, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAddQuantity(val)}
                    className={`inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full border text-[12px] font-semibold tabular-nums transition-colors cursor-pointer ${
                      addQuantity === val
                        ? "border-black bg-black text-white"
                        : "border-black/12 bg-white text-black hover:bg-[#F5F5F2]"
                    }`}
                  >
                    {val} {addUnit || "pcs"}
                  </button>
                ))}
              </div>
            </div>

            {/* Visible to Students Toggle */}
            <label className="flex min-h-[52px] items-center justify-between gap-3 rounded-[16px] bg-[#F5F5F2] px-4 py-2.5 cursor-pointer select-none">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-black">
                  Visible to Students &amp; Instructors
                </p>
                <p className="text-[12px] text-black/55">
                  Publish immediately in the campus borrowing catalog
                </p>
              </div>
              <Switch
                checked={addVisible}
                onCheckedChange={setAddVisible}
                className="data-[state=checked]:bg-[#16A34A] data-[state=unchecked]:bg-black/20"
              />
            </label>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="add-notes"
                className="text-[12.5px] font-semibold text-black/75"
              >
                Notes / Specs
              </label>
              <textarea
                id="add-notes"
                rows={2}
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Shelf bin location, kit contents, or intake remarks..."
                className="w-full rounded-[16px] border border-black/14 bg-white px-3.5 py-2.5 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:outline-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13.5px] font-medium text-black hover:bg-[#F5F5F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-[#C4F041] px-5 text-[13.5px] font-semibold text-black ring-1 ring-black/12 transition-colors hover:bg-[#B8E635] disabled:opacity-45 cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>{addSaving ? "Adding..." : "Register Stock"}</span>
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DottedGridCanvas>
  );
}

export default function LabManagerInventoryPage() {
  return (
    <SmoothScrollProvider>
      <LabManagerInventoryInner />
    </SmoothScrollProvider>
  );
}
