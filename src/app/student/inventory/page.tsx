"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cpu, PlusCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_CATEGORIES } from "@/lib/demo-data";
import type { CampusInventoryDTO, ItemCategoryDTO } from "@/types/contracts";

export default function StudentInventoryBrowsePage() {
  const [items, setItems] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "available">("name");

  useEffect(() => {
    Promise.all([
      apiClient.inventory.list({ pageSize: 100 }).then((r) => r.data),
      apiClient.categories.list().then((r) => r.data),
    ])
      .then(([inv, cats]) => {
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
    const list = items.filter((r) => {
      if (categoryFilter !== "ALL" && r.item.category.id !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.item.name.toLowerCase().includes(q) ||
        r.item.code.toLowerCase().includes(q) ||
        (r.item.description?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...list].sort((a, b) =>
      sortBy === "available"
        ? b.availableQuantity - a.availableQuantity
        : a.item.name.localeCompare(b.item.name)
    );
  }, [items, search, categoryFilter, sortBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Lab Equipment Catalog"
        description="Browse verified equipment currently available for borrowing at your campus laboratory."
        actions={
          <Button asChild>
            <Link href="/student/new-request">
              <PlusCircle className="h-4 w-4" />
              Build Multi-Item Request
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search oscilloscopes, Raspberry Pi, sensors..."
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
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as "name" | "available")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
            <SelectItem value="available">Sort: Most Available</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const specs = row.item.specifications
              ? Object.entries(row.item.specifications).slice(0, 3)
              : [];
            return (
              <Card
                key={row.id}
                className="overflow-hidden flex flex-col justify-between hover:border-[#F26943]/40 transition-colors"
              >
                <div>
                  <div className="relative h-36 bg-gradient-to-br from-[#FAF9F6] to-[#EAE9E4] flex items-center justify-center border-b border-[#EFECE6]">
                    {row.item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.item.imageUrl}
                        alt={row.item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-[#72736E]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-[#E6E5E0] text-[#F26943] shadow-xs">
                          <Cpu className="h-6 w-6" />
                        </div>
                        <span className="font-mono text-[11px] font-semibold">
                          {row.item.code}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge
                        variant={
                          row.availableQuantity > 0 ? "success" : "danger"
                        }
                      >
                        {row.availableQuantity} {row.item.unit} avail
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {row.item.category.name}
                      </Badge>
                      {row.item.brand && (
                        <span className="text-xs text-[#72736E]">
                          {row.item.brand}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#222321] leading-snug">
                      {row.item.name}
                    </h3>
                    {row.item.description && (
                      <p className="text-xs text-[#72736E] line-clamp-2 leading-relaxed">
                        {row.item.description}
                      </p>
                    )}

                    {specs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {specs.map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-md bg-[#FAF9F6] border border-[#EFECE6] px-2 py-0.5 text-[10px] text-[#585955]"
                          >
                            {k}: <strong>{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2">
                  <Button
                    className="w-full"
                    variant={row.availableQuantity > 0 ? "default" : "outline"}
                    disabled={row.availableQuantity <= 0}
                    asChild={row.availableQuantity > 0}
                  >
                    {row.availableQuantity > 0 ? (
                      <Link
                        href={`/student/new-request?itemId=${row.item.id}`}
                      >
                        <PlusCircle className="h-4 w-4" />
                        Add to Request
                      </Link>
                    ) : (
                      <span>Currently Out of Stock</span>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
