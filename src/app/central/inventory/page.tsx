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
import { formatNumber } from "@/lib/utils";
import type { ItemCategoryDTO, MasterItemDTO } from "@/types/contracts";

export default function CentralMasterInventoryPage() {
  const [items, setItems] = useState<MasterItemDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
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
    unit: "unit",
    description: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [itemRes, catRes] = await Promise.all([
        apiClient.items.list({ pageSize: 100 }),
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

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "ALL" && item.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.brand?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, categoryFilter, statusFilter]);

  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      code: "",
      name: "",
      categoryId: categories[0]?.id ?? "",
      brand: "",
      unit: "unit",
      description: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (item: MasterItemDTO) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      name: item.name,
      categoryId: item.categoryId,
      brand: item.brand ?? "",
      unit: item.unit,
      description: item.description ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.categoryId) {
      toast.error("Code, item name, and category are required");
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        const res = await apiClient.items.update(editingItem.id, {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          categoryId: form.categoryId,
          brand: form.brand.trim() || undefined,
          unit: form.unit.trim() || "unit",
          description: form.description.trim() || undefined,
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
          brand: form.brand.trim() || undefined,
          unit: form.unit.trim() || "unit",
          description: form.description.trim() || undefined,
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
            Equipment Name
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-black">{row.original.name}</p>
            {row.original.brand && (
              <p className="text-xs text-black/55">{row.original.brand}</p>
            )}
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (row) => row.category?.name ?? "—",
        cell: ({ getValue }) => (
          <Badge variant="secondary">{String(getValue())}</Badge>
        ),
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
        id: "borrowed",
        header: () => <div className="text-right">Borrowed</div>,
        accessorFn: (row) => row.summary?.totalBorrowed ?? 0,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums text-black">
            {formatNumber(Number(getValue()))}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "outline"}>
            {row.original.isActive ? "Active" : "Inactive"}
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
    initialState: { pagination: { pageSize: 12 } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Inventory Catalog"
        description="Global equipment registry managed exclusively by the Central Lab Manager and distributed to all 40 campuses."
        actions={
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add Master Item
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU code, name, or brand..."
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
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
        <DialogContent>
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
                  placeholder="INS-OSC-200"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  placeholder="unit / kit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                placeholder="Keysight Digital Storage Oscilloscope"
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
                <Label htmlFor="item-brand">Brand</Label>
                <Input
                  id="item-brand"
                  placeholder="Rigol / Fluke / NVIDIA"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                placeholder="Specifications, accessories included, calibration notes..."
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
