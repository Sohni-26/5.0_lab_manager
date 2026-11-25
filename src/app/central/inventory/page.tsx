"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  PowerOff,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { DEMO_CATEGORIES, DEMO_MASTER_ITEMS } from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  formatInr,
  PROCUREMENT_LAB_BLOCKS,
  PROCUREMENT_STATUS_META,
  type AllocationScope,
  type ProcurementStatus,
} from "@/lib/procurement-catalog";
import { formatNumber } from "@/lib/utils";
import type { ItemCategoryDTO, MasterItemDTO } from "@/types/contracts";

export default function CentralMasterInventoryPage() {
  const [items, setItems] = useState<MasterItemDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [procurementFilter, setProcurementFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItemDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    categoryId: "",
    brand: "",
    unit: "pcs",
    description: "",
    labBlock: PROCUREMENT_LAB_BLOCKS[0] as string,
    procurementStatus: "PENDING" as ProcurementStatus,
    allocationScope: "PER_CAMPUS" as AllocationScope,
    vendorActual: "",
    unitPriceInr: "",
    procurementQty: "",
    productUrl: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [itemRes, catRes] = await Promise.all([
        apiClient.items.list({ pageSize: 250 }),
        apiClient.categories.list(),
      ]);
      setItems(itemRes.data);
      setCategories(catRes.data);
    } catch {
      setItems(DEMO_MASTER_ITEMS);
      setCategories(DEMO_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    let activeCount = 0;
    let draftCount = 0;
    let totalProcurementInr = 0;
    let prPipelineCount = 0;
    let receivedCount = 0;
    let unavailableCount = 0;

    for (const item of items) {
      if (item.isActive) activeCount += 1;
      else draftCount += 1;

      const meta = extractItemProcurementMeta(item.specifications);
      if (meta.totalPriceInr && meta.totalPriceInr > 0) {
        totalProcurementInr += meta.totalPriceInr;
      } else if (meta.unitPriceInr && meta.procurementQty) {
        totalProcurementInr += meta.unitPriceInr * meta.procurementQty;
      }

      if (meta.procurementStatus === "RECEIVED") receivedCount += 1;
      else if (
        meta.procurementStatus === "PR_RAISED" ||
        meta.procurementStatus === "PAYMENT_DONE" ||
        meta.procurementStatus === "QUOTATION_RECEIVED"
      ) {
        prPipelineCount += 1;
      } else if (meta.procurementStatus === "UNAVAILABLE") {
        unavailableCount += 1;
      }
    }

    return {
      activeCount,
      draftCount,
      totalProcurementInr,
      prPipelineCount,
      receivedCount,
      unavailableCount,
    };
  }, [items]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const meta = extractItemProcurementMeta(item.specifications);

      if (categoryFilter !== "ALL" && item.categoryId !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (
        procurementFilter !== "ALL" &&
        meta.procurementStatus !== procurementFilter
      ) {
        return false;
      }
      if (scopeFilter !== "ALL" && meta.allocationScope !== scopeFilter) {
        return false;
      }
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.brand?.toLowerCase().includes(q) ?? false) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false) ||
        (meta.vendorActual?.toLowerCase().includes(q) ?? false) ||
        (meta.vendorResearch?.toLowerCase().includes(q) ?? false) ||
        (meta.remarks?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [
    items,
    search,
    categoryFilter,
    labBlockFilter,
    procurementFilter,
    scopeFilter,
    statusFilter,
  ]);

  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      code: "",
      name: "",
      categoryId: categories[0]?.id ?? "",
      brand: "",
      unit: "pcs",
      description: "",
      labBlock: "IoT Component Organiser",
      procurementStatus: "PENDING",
      allocationScope: "PER_CAMPUS",
      vendorActual: "",
      unitPriceInr: "",
      procurementQty: "",
      productUrl: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (item: MasterItemDTO) => {
    const meta = extractItemProcurementMeta(item.specifications);
    setEditingItem(item);
    setForm({
      code: item.code,
      name: item.name,
      categoryId: item.categoryId,
      brand: item.brand ?? "",
      unit: item.unit,
      description: item.description ?? "",
      labBlock: meta.labBlock ?? "IoT Component Organiser",
      procurementStatus: meta.procurementStatus ?? "PENDING",
      allocationScope: meta.allocationScope ?? "PER_CAMPUS",
      vendorActual: meta.vendorActual ?? item.brand ?? "",
      unitPriceInr:
        meta.unitPriceInr !== null ? String(meta.unitPriceInr) : "",
      procurementQty:
        meta.procurementQty !== null ? String(meta.procurementQty) : "",
      productUrl: meta.productUrl ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.categoryId) {
      toast.error("Code, item name, and category are required");
      return;
    }

    const parsedUnitPrice = form.unitPriceInr.trim()
      ? Number(form.unitPriceInr)
      : undefined;
    const parsedProcQty = form.procurementQty.trim()
      ? Number(form.procurementQty)
      : undefined;

    const mergedSpecs: Record<string, unknown> = {
      ...(editingItem?.specifications ?? {}),
      labBlock: form.labBlock,
      procurementStatus: form.procurementStatus,
      allocationScope: form.allocationScope,
      ...(form.vendorActual.trim()
        ? { vendorActual: form.vendorActual.trim() }
        : {}),
      ...(form.productUrl.trim() ? { productUrl: form.productUrl.trim() } : {}),
      ...(parsedUnitPrice !== undefined && !Number.isNaN(parsedUnitPrice)
        ? { unitPriceInr: parsedUnitPrice }
        : {}),
      ...(parsedProcQty !== undefined && !Number.isNaN(parsedProcQty)
        ? { procurementQty: parsedProcQty }
        : {}),
      ...(parsedUnitPrice !== undefined &&
      parsedProcQty !== undefined &&
      !Number.isNaN(parsedUnitPrice) &&
      !Number.isNaN(parsedProcQty)
        ? { totalPriceInr: Number((parsedUnitPrice * parsedProcQty).toFixed(2)) }
        : {}),
    };

    setSaving(true);
    try {
      if (editingItem) {
        const res = await apiClient.items.update(editingItem.id, {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          categoryId: form.categoryId,
          brand: form.brand.trim() || form.vendorActual.trim() || undefined,
          unit: form.unit.trim() || "pcs",
          description: form.description.trim() || undefined,
          specifications: mergedSpecs,
        });
        setItems((prev) =>
          prev.map((it) => (it.id === editingItem.id ? res.data : it))
        );
        toast.success(`Updated ${res.data.name}`);
      } else {
        const res = await apiClient.items.create({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          categoryId: form.categoryId,
          brand: form.brand.trim() || form.vendorActual.trim() || undefined,
          unit: form.unit.trim() || "pcs",
          description: form.description.trim() || undefined,
          specifications: mergedSpecs,
        });
        setItems((prev) => [res.data, ...prev]);
        toast.success(`Added ${res.data.name} to master catalog`);
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = useCallback(async (item: MasterItemDTO) => {
    try {
      await apiClient.items.deactivate(item.id);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, isActive: false } : it))
      );
      toast.success(`${item.code} deactivated (historical records preserved)`);
    } catch {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, isActive: false } : it))
      );
      toast.success(`${item.code} deactivated (preview)`);
    }
  }, []);

  const columns = useMemo<ColumnDef<MasterItemDTO>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Item Code",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 font-mono text-xs font-semibold text-black">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 cursor-pointer transition-colors duration-150 hover:text-black"
          >
            Equipment &amp; Vendor
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const meta = extractItemProcurementMeta(row.original.specifications);
          const vendorLabel = meta.vendorActual || row.original.brand;
          return (
            <div className="min-w-[210px] max-w-[300px]">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-black truncate">
                  {row.original.name}
                </p>
                {meta.productUrl && (
                  <a
                    href={meta.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open vendor product link"
                    className="shrink-0 text-black/45 hover:text-black transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {vendorLabel && (
                  <span className="text-xs text-black/55">{vendorLabel}</span>
                )}
                {meta.allocationScope === "ALL_40_LABS" && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-[#C4F041]/55 px-2 py-0.5 text-[10px] font-semibold text-black">
                    40-Lab Kit Pool
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Category & Lab Block",
        accessorFn: (row) => row.category?.name ?? "—",
        cell: ({ row }) => {
          const meta = extractItemProcurementMeta(row.original.specifications);
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant="secondary">
                {row.original.category?.name ?? "—"}
              </Badge>
              {meta.labBlock && (
                <span className="inline-flex items-center gap-1 text-[11px] text-black/60">
                  <MapPin className="h-3 w-3 shrink-0 text-black/45" />
                  {meta.labBlock}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "procurementStatus",
        header: "Procurement",
        accessorFn: (row) =>
          extractItemProcurementMeta(row.specifications).procurementStatus ??
          "PENDING",
        cell: ({ row }) => {
          const meta = extractItemProcurementMeta(row.original.specifications);
          const statusKey = meta.procurementStatus ?? "PENDING";
          const statusInfo = PROCUREMENT_STATUS_META[statusKey];
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant={statusInfo.badgeVariant}>
                {statusInfo.label}
              </Badge>
              {meta.remarks && (
                <span className="max-w-[170px] truncate text-[11px] text-black/55" title={meta.remarks}>
                  {meta.remarks}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "cost",
        header: () => <div className="text-right">Unit / Total (INR)</div>,
        accessorFn: (row) =>
          extractItemProcurementMeta(row.specifications).totalPriceInr ?? 0,
        cell: ({ row }) => {
          const meta = extractItemProcurementMeta(row.original.specifications);
          if (!meta.unitPriceInr && !meta.totalPriceInr) {
            return (
              <div className="text-right text-xs text-black/45 tabular-nums">
                Unpriced
              </div>
            );
          }
          return (
            <div className="text-right tabular-nums whitespace-nowrap">
              <p className="text-xs font-semibold text-black">
                {meta.totalPriceInr !== null
                  ? formatInr(meta.totalPriceInr)
                  : "—"}
              </p>
              <p className="text-[11px] text-black/55">
                {meta.unitPriceInr !== null
                  ? formatInr(meta.unitPriceInr)
                  : "—"}{" "}
                × {formatNumber(meta.procurementQty ?? 0)}
              </p>
            </div>
          );
        },
      },
      {
        id: "allocated",
        header: () => <div className="text-right">Allocated</div>,
        accessorFn: (row) => row.summary?.totalAllocated ?? 0,
        cell: ({ getValue }) => (
          <div className="text-right font-medium tabular-nums text-black">
            {formatNumber(Number(getValue()))}
          </div>
        ),
      },
      {
        id: "available",
        header: () => <div className="text-right">Available</div>,
        accessorFn: (row) => row.summary?.totalAvailable ?? 0,
        cell: ({ getValue }) => (
          <div className="text-right">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/55 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-black">
              {formatNumber(Number(getValue()))}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Catalog",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "outline"}>
            {row.original.isActive ? "Active" : "Draft / Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditModal(row.original)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
            {row.original.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8.5 w-8.5 rounded-full text-black/65 hover:bg-[#FA8E66]/35 hover:text-black"
                title="Deactivate item"
                onClick={() => handleDeactivate(row.original)}
              >
                <PowerOff className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleDeactivate]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Inventory & Procurement Catalog"
        description="Real 5.0 Lab equipment registry (166 SKUs across 12 categories and 6 physical lab blocks) managed centrally for all 40 campuses."
        actions={
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add Master Item
          </Button>
        }
      />

      {/* Procurement & Catalog Telemetry Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[22px] border border-black/12 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-black/55">Active Catalog SKUs</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-black">
            {formatNumber(summary.activeCount)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/50 tabular-nums">
            {summary.draftCount} draft / needs specs
          </p>
        </div>
        <div className="rounded-[22px] border border-black/12 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-black/55">Procurement Value</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-black">
            {formatInr(summary.totalProcurementInr)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/50">
            Recomputed from unit × qty
          </p>
        </div>
        <div className="rounded-[22px] border border-black/12 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-black/55">PR / Payment Pipeline</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-black">
            {formatNumber(summary.prPipelineCount)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/50">
            PR Raised, Quoted &amp; Paid
          </p>
        </div>
        <div className="rounded-[22px] border border-black/12 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-black/55">Stock Received</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-black">
            {formatNumber(summary.receivedCount)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/50">
            Ready for campus dispatch
          </p>
        </div>
        <div className="rounded-[22px] border border-black/12 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-black/55">Vendor Unavailable</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-black">
            {formatNumber(summary.unavailableCount)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/50">
            Requires alternate sourcing
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, vendor, or lab block..."
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories ({categories.length})</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={labBlockFilter} onValueChange={setLabBlockFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Lab Blocks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Lab Blocks</SelectItem>
            {PROCUREMENT_LAB_BLOCKS.map((block) => (
              <SelectItem key={block} value={block}>
                {block}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={procurementFilter} onValueChange={setProcurementFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Procurement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Procurement</SelectItem>
            {(Object.keys(PROCUREMENT_STATUS_META) as ProcurementStatus[]).map(
              (st) => (
                <SelectItem key={st} value={st}>
                  {PROCUREMENT_STATUS_META[st].label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Scopes</SelectItem>
            <SelectItem value="PER_CAMPUS">Per Campus</SelectItem>
            <SelectItem value="ALL_40_LABS">40-Lab Kit Pool</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Catalog" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Catalog</SelectItem>
            <SelectItem value="ACTIVE">Active Only</SelectItem>
            <SelectItem value="INACTIVE">Draft / Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TanStack Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="border-b border-black/10 px-4 py-3 text-left">
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
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-black/55">
                    Loading master inventory...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-10 text-center text-black/55">
                    No items match your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[#F5F5F3]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-black/10 px-4 py-3 text-xs text-black/55">
          <span>
            Showing{" "}
            <span className="font-medium tabular-nums text-black">
              {table.getRowModel().rows.length}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-black">
              {filteredData.length}
            </span>{" "}
            items
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span>
              Page{" "}
              <span className="font-medium tabular-nums text-black">
                {table.getState().pagination.pageIndex + 1}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-black">
                {Math.max(1, table.getPageCount())}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Item Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-[#C4F041] text-black">
                <Package className="h-4 w-4" />
              </span>
              {editingItem ? "Edit Master Item" : "Add Master Inventory Item"}
            </DialogTitle>
            <DialogDescription>
              Master items become available for central allocation across all 40 campuses.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-code">Item Code</Label>
                <Input
                  id="item-code"
                  placeholder="DEV-069"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  placeholder="pcs / kit / set"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                placeholder="ESP32-S3 DevKit / Bambu Lab P1S"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lab Block / Arena</Label>
                <Select
                  value={form.labBlock}
                  onValueChange={(v) => setForm({ ...form, labBlock: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lab block" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCUREMENT_LAB_BLOCKS.map((block) => (
                      <SelectItem key={block} value={block}>
                        {block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Procurement Status</Label>
                <Select
                  value={form.procurementStatus}
                  onValueChange={(v) =>
                    setForm({ ...form, procurementStatus: v as ProcurementStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROCUREMENT_STATUS_META) as ProcurementStatus[]).map(
                      (st) => (
                        <SelectItem key={st} value={st}>
                          {PROCUREMENT_STATUS_META[st].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Allocation Scope</Label>
                <Select
                  value={form.allocationScope}
                  onValueChange={(v) =>
                    setForm({ ...form, allocationScope: v as AllocationScope })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_CAMPUS">Per Campus Standard</SelectItem>
                    <SelectItem value="ALL_40_LABS">40-Lab Innovators Kit Pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-vendor">Actual Vendor</Label>
                <Input
                  id="item-vendor"
                  placeholder="RoboCraze / Robu / Wol 3D"
                  value={form.vendorActual}
                  onChange={(e) =>
                    setForm({ ...form, vendorActual: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-brand">Brand</Label>
                <Input
                  id="item-brand"
                  placeholder="Arduino / NVIDIA / Soldron"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">Unit Price (INR)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="450"
                  value={form.unitPriceInr}
                  onChange={(e) =>
                    setForm({ ...form, unitPriceInr: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-proc-qty">Procurement Qty</Label>
                <Input
                  id="item-proc-qty"
                  type="number"
                  min={0}
                  placeholder="20"
                  value={form.procurementQty}
                  onChange={(e) =>
                    setForm({ ...form, procurementQty: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-url">Vendor Product URL</Label>
              <Input
                id="item-url"
                type="url"
                placeholder="https://robocraze.com/products/..."
                value={form.productUrl}
                onChange={(e) => setForm({ ...form, productUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description &amp; Notes</Label>
              <Textarea
                id="item-desc"
                placeholder="Specifications, accessories included, remarks..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingItem
                    ? "Save Changes"
                    : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
