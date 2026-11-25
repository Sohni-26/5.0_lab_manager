"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Lock, MapPin, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_CATEGORIES } from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import type { CampusInventoryDTO, ItemCategoryDTO } from "@/types/contracts";

export default function InstructorInventoryReadOnlyPage() {
  const [items, setItems] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");

  useEffect(() => {
    Promise.all([
      apiClient.inventory.list({ pageSize: 250 }).then((r) => r.data),
      apiClient.categories.list().then((r) => r.data),
    ])
      .then(([inv, cats]) => {
        // Strictly verified & visible items only
        setItems(inv.filter((i) => i.isVerified && i.isVisible));
        setCategories(cats);
      })
      .catch(() => {
        setItems(
          DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
        );
        setCategories(DEMO_CATEGORIES);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
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
        (r.item.brand?.toLowerCase().includes(q) ?? false) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, categoryFilter, labBlockFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Inventory (Read-Only)"
        description="Verified and visible equipment currently stocked across your campus lab blocks. Stock edits and visibility toggles are managed exclusively by your Campus Lab Manager."
        badge={
          <Badge variant="outline">
            <Lock className="h-3 w-3" /> Read-only view
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment name, code, brand, or lab block..."
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52 border-black/15 text-black focus:border-black focus:ring-[#C4F041]/50">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="border-black/12 bg-white text-black">
            <SelectItem value="ALL" className="focus:bg-[#F5F5F3] focus:text-black">
              All Categories
            </SelectItem>
            {categories.map((c) => (
              <SelectItem
                key={c.id}
                value={c.id}
                className="focus:bg-[#F5F5F3] focus:text-black"
              >
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={labBlockFilter} onValueChange={setLabBlockFilter}>
          <SelectTrigger className="w-52 border-black/15 text-black focus:border-black focus:ring-[#C4F041]/50">
            <SelectValue placeholder="All Lab Blocks" />
          </SelectTrigger>
          <SelectContent className="border-black/12 bg-white text-black">
            <SelectItem value="ALL" className="focus:bg-[#F5F5F3] focus:text-black">
              All Lab Blocks
            </SelectItem>
            {PROCUREMENT_LAB_BLOCKS.map((block) => (
              <SelectItem
                key={block}
                value={block}
                className="focus:bg-[#F5F5F3] focus:text-black"
              >
                {block}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-black/55 tabular-nums">
          {filtered.length} items
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="border-b border-black/10 text-left">
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Lab Block</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Borrowed</th>
                <th className="px-4 py-3">Availability</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-black/55">
                    Loading verified campus inventory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-black/55">
                    No equipment matches your current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const meta = extractItemProcurementMeta(row.item.specifications);
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-[#F5F5F3]">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
                          {row.item.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-black">{row.item.name}</p>
                        {row.item.brand && (
                          <p className="text-xs text-black/55">{row.item.brand}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{row.item.category.name}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {meta.labBlock ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 text-xs text-black/75">
                            <MapPin className="h-3 w-3 text-black/45" />
                            {meta.labBlock}
                          </span>
                        ) : (
                          <span className="text-xs text-black/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/65 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-black">
                          {row.availableQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-[#BCE6FA]/75 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
                          {row.reservedQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums text-black">
                        {row.borrowedQuantity}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.availableQuantity > 3
                              ? "success"
                              : row.availableQuantity > 0
                                ? "warning"
                                : "danger"
                          }
                        >
                          {row.availableQuantity > 3
                            ? "In Stock"
                            : row.availableQuantity > 0
                              ? "Low Stock"
                              : "Out of Stock"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
