"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ArrowUpDown,
  Columns3,
  Download,
  Eye,
  EyeOff,
  MapPin,
  Radio,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_CATEGORIES } from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  formatInr,
  PROCUREMENT_LAB_BLOCKS,
  PROCUREMENT_STATUS_META,
} from "@/lib/procurement-catalog";
import { exportToCsv, formatDateTime } from "@/lib/utils";
import type { CampusInventoryDTO, ItemCategoryDTO } from "@/types/contracts";

export default function LabManagerInventorySheetPage() {
  const { isDemoMode } = useAuth();
  const [rows, setRows] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveFlash, setLiveFlash] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Stock adjustment modal
  const [adjustItem, setAdjustItem] = useState<CampusInventoryDTO | null>(null);
  const [adjustField, setAdjustField] = useState<
    "availableQuantity" | "damagedQuantity" | "missingQuantity"
  >("availableQuantity");
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustRemarks, setAdjustRemarks] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const [invRes, catRes] = await Promise.all([
        apiClient.inventory.list({ pageSize: 250 }),
        apiClient.categories.list(),
      ]);
      setRows(invRes.data);
      setCategories(catRes.data);
    } catch {
      setRows(DEMO_CAMPUS_INVENTORY);
      setCategories(DEMO_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: [
      "inventory.updated",
      "inventory.visibility_changed",
      "allocation.verified",
      "request.status_changed",
      "borrowing.issued",
      "return.verified",
    ],
    onEvent: () => {
      setLiveFlash(true);
      loadInventory();
      setTimeout(() => setLiveFlash(false), 1800);
    },
  });

  const handleToggleVisibility = useCallback(
    async (record: CampusInventoryDTO, nextVisible: boolean) => {
      // Optimistic update
      setRows((prev) =>
        prev.map((r) =>
          r.id === record.id ? { ...r, isVisible: nextVisible } : r
        )
      );
      try {
        await apiClient.inventory.toggleVisibility(record.id, nextVisible);
        toast.success(
          `${record.item.code} is now ${
            nextVisible ? "visible to instructors & students" : "hidden from catalog"
          }`
        );
      } catch (err) {
        if (!isDemoMode) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === record.id ? { ...r, isVisible: !nextVisible } : r
            )
          );
          toast.error(
            err instanceof Error ? err.message : "Failed to update visibility"
          );
        } else {
          toast.success(`Visibility updated (preview mode)`);
        }
      }
    },
    [isDemoMode]
  );

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const meta = extractItemProcurementMeta(r.item.specifications);
      if (categoryFilter !== "ALL" && r.item.category.id !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (visibilityFilter === "VISIBLE" && !r.isVisible) return false;
      if (visibilityFilter === "HIDDEN" && r.isVisible) return false;
      if (!q) return true;
      return (
        r.item.name.toLowerCase().includes(q) ||
        r.item.code.toLowerCase().includes(q) ||
        r.item.category.name.toLowerCase().includes(q) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false) ||
        (meta.vendorActual?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, categoryFilter, labBlockFilter, visibilityFilter]);

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
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
            aria-label="Select row"
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
            className="inline-flex items-center gap-1 cursor-pointer transition-colors duration-150 hover:text-black"
          >
            Item Name <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const meta = extractItemProcurementMeta(row.original.item.specifications);
          return (
            <div className="min-w-[190px]">
              <p className="font-medium text-black">{row.original.item.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {meta.unitPriceInr !== null && (
                  <span className="text-[11px] text-black/55 tabular-nums">
                    {formatInr(meta.unitPriceInr)}/unit
                  </span>
                )}
                {meta.procurementStatus && meta.procurementStatus !== "RECEIVED" && (
                  <Badge
                    variant={PROCUREMENT_STATUS_META[meta.procurementStatus].badgeVariant}
                    className="px-2 py-0 text-[10px]"
                  >
                    {PROCUREMENT_STATUS_META[meta.procurementStatus].label}
                  </Badge>
                )}
                {!row.original.isVerified && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F3BD77]/75 px-2 py-0.5 text-[10px] font-semibold text-black">
                    Unverified stock
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "itemCode",
        accessorFn: (row) => row.item.code,
        header: "Item Code",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 font-mono text-xs font-semibold text-black">
            {row.original.item.code}
          </span>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.item.category.name,
        header: "Category",
        cell: ({ getValue }) => (
          <Badge variant="secondary" className="text-[11px]">
            {String(getValue())}
          </Badge>
        ),
      },
      {
        id: "labBlock",
        accessorFn: (row) =>
          extractItemProcurementMeta(row.item.specifications).labBlock ?? "—",
        header: "Lab Block",
        cell: ({ getValue }) => {
          const val = String(getValue());
          return val !== "—" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 text-[11px] text-black/75 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-black/45" />
              {val}
            </span>
          ) : (
            <span className="text-xs text-black/40">—</span>
          );
        },
      },
      {
        accessorKey: "allocatedQuantity",
        header: () => <div className="text-right">Allocated</div>,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-xs tabular-nums text-black">
            {Number(getValue())}
          </div>
        ),
      },
      {
        accessorKey: "receivedQuantity",
        header: () => <div className="text-right">Received</div>,
        cell: ({ getValue }) => (
          <div className="text-right font-mono text-xs tabular-nums text-black">
            {Number(getValue())}
          </div>
        ),
      },
      {
        accessorKey: "availableQuantity",
        header: () => <div className="text-right">Available</div>,
        cell: ({ getValue }) => (
          <div className="text-right">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/65 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-black">
              {Number(getValue())}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "reservedQuantity",
        header: () => <div className="text-right">Reserved</div>,
        cell: ({ getValue }) => (
          <div className="text-right">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#BCE6FA]/75 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
              {Number(getValue())}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "borrowedQuantity",
        header: () => <div className="text-right">Borrowed</div>,
        cell: ({ getValue }) => (
          <div className="text-right">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F3BD77]/65 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
              {Number(getValue())}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "damagedQuantity",
        header: () => <div className="text-right">Damaged</div>,
        cell: ({ getValue }) => {
          const val = Number(getValue());
          return (
            <div className="text-right">
              {val > 0 ? (
                <span className="inline-flex items-center rounded-full border border-black/10 bg-[#FA8E66]/75 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
                  {val}
                </span>
              ) : (
                <span className="font-mono text-xs font-semibold tabular-nums text-black/45">
                  {val}
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
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.isVisible}
              onCheckedChange={(v) => handleToggleVisibility(row.original, v)}
            />
            <span className="text-[11px] text-black/55">
              {row.original.isVisible ? "Visible" : "Hidden"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Last Updated",
        cell: ({ row }) => (
          <span className="text-xs text-black/55 whitespace-nowrap tabular-nums">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdjustItem(row.original);
                setAdjustField("availableQuantity");
                setAdjustDelta(0);
                setAdjustRemarks("");
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [handleToggleVisibility]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  const handleBulkVisibility = async (isVisible: boolean) => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, isVisible } : r))
    );
    setRowSelection({});
    try {
      await apiClient.inventory.bulkVisibility(ids, isVisible);
      toast.success(
        `${ids.length} item(s) marked ${isVisible ? "visible" : "hidden"}`
      );
    } catch {
      toast.success(`${ids.length} item(s) updated (preview mode)`);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `campus-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredData.map((r) => {
        const meta = extractItemProcurementMeta(r.item.specifications);
        return {
          ItemCode: r.item.code,
          ItemName: r.item.name,
          Category: r.item.category.name,
          LabBlock: meta.labBlock ?? "",
          Vendor: meta.vendorActual ?? r.item.brand ?? "",
          UnitPriceINR: meta.unitPriceInr ?? "",
          ProcurementStatus: meta.procurementStatus ?? "",
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
    toast.success("Exported campus inventory CSV");
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    if (adjustDelta === 0) {
      toast.error("Delta cannot be 0");
      return;
    }
    if (adjustRemarks.trim().length < 3) {
      toast.error("Mandatory audit remarks (min 3 characters) required");
      return;
    }
    setAdjustSaving(true);
    try {
      const res = await apiClient.inventory.adjust(adjustItem.id, {
        field: adjustField,
        delta: adjustDelta,
        remarks: adjustRemarks.trim(),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === adjustItem.id ? res.data : r))
      );
      toast.success(`Adjusted ${adjustItem.item.code} and logged transaction`);
      setAdjustItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setAdjustSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campus Inventory Sheet"
        description="Live spreadsheet-style inventory table with instant visibility controls, bulk updates, CSV export, and real-time transaction sync."
        badge={
          <Badge
            variant={liveFlash ? "accent" : "success"}
            className="transition-colors duration-150"
          >
            <Radio className={`h-3 w-3 ${liveFlash ? "animate-ping" : "animate-pulse"}`} />
            {liveFlash ? "Synced just now" : "Live Sheet"}
          </Badge>
        }
        actions={
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item name, SKU code..."
              className="pl-10 h-9"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={labBlockFilter} onValueChange={setLabBlockFilter}>
            <SelectTrigger className="w-48 h-9 text-xs">
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

          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Items</SelectItem>
              <SelectItem value="VISIBLE">Visible Only</SelectItem>
              <SelectItem value="HIDDEN">Hidden Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#C4F041]/35 border border-black/15 px-3 py-1">
              <span className="text-xs font-semibold tabular-nums text-black mr-1">
                {selectedRows.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleBulkVisibility(true)}
              >
                <Eye className="h-3 w-3" /> Show
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleBulkVisibility(false)}
              >
                <EyeOff className="h-3 w-3" /> Hide
              </Button>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
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
                    {col.id.replace(/Quantity$/, "")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Google Sheets-inspired Dynamic Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="border-b border-black/10 px-3.5 py-3 text-left whitespace-nowrap">
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
                    Loading live campus inventory...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-10 text-center text-black/55">
                    No inventory items match your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors duration-150 ${
                      row.getIsSelected()
                        ? "bg-[#C4F041]/15"
                        : "hover:bg-[#F5F5F3]"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3.5 py-2.5">
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
      </Card>

      {/* Authorised Inventory Adjustment Modal */}
      <Dialog
        open={Boolean(adjustItem)}
        onOpenChange={(o) => !o && setAdjustItem(null)}
      >
        <DialogContent>
          {adjustItem && (
            <>
              <DialogHeader>
                <DialogTitle>Adjust Campus Stock</DialogTitle>
                <DialogDescription>
                  {adjustItem.item.code} · {adjustItem.item.name}. Every adjustment writes
                  an immutable{" "}
                  <code className="rounded-md bg-[#F5F5F3] px-1.5 py-0.5 font-mono text-xs text-black">
                    INVENTORY_ADJUSTMENT
                  </code>{" "}
                  transaction.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitAdjustment} className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-[#F5F5F3] border border-black/10 p-3 text-center text-xs">
                  <div>
                    <p className="text-black/55">Available</p>
                    <p className="mt-1 inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/65 px-2.5 py-0.5 font-mono font-bold tabular-nums text-black">
                      {adjustItem.availableQuantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-black/55">Damaged</p>
                    <p className="mt-1 inline-flex items-center rounded-full border border-black/10 bg-[#FA8E66]/75 px-2.5 py-0.5 font-mono font-bold tabular-nums text-black">
                      {adjustItem.damagedQuantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-black/55">Missing</p>
                    <p className="mt-1 inline-flex items-center rounded-full border border-black/10 bg-[#F3BD77]/75 px-2.5 py-0.5 font-mono font-bold tabular-nums text-black">
                      {adjustItem.missingQuantity}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Stock Bucket</Label>
                    <Select
                      value={adjustField}
                      onValueChange={(v) =>
                        setAdjustField(
                          v as
                            | "availableQuantity"
                            | "damagedQuantity"
                            | "missingQuantity"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="availableQuantity">Available Qty</SelectItem>
                        <SelectItem value="damagedQuantity">Damaged Qty</SelectItem>
                        <SelectItem value="missingQuantity">Missing Qty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adj-delta">Delta (+/-)</Label>
                    <Input
                      id="adj-delta"
                      type="number"
                      value={adjustDelta}
                      onChange={(e) => setAdjustDelta(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-remarks">Mandatory Audit Remarks</Label>
                  <Textarea
                    id="adj-remarks"
                    placeholder="Reason for adjustment (e.g., Repaired unit returned to service after calibration)"
                    value={adjustRemarks}
                    onChange={(e) => setAdjustRemarks(e.target.value)}
                    required
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdjustItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adjustSaving}>
                    {adjustSaving ? "Saving..." : "Apply Adjustment"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
